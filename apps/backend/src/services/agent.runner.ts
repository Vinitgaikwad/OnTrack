import type { PrismaClient } from '../generated/prisma/client'
import type { Env } from '../types'
import { AppError } from '../lib/http'
import { decrypt } from '../lib/crypto'
import { DEFAULT_BASE_URL, FALLBACK_MODEL, resolveBaseUrl } from '../lib/llm-providers'
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseActionItems,
  stripActionLines,
  type PendingAction,
} from '../lib/agent-prompts'
import { generateWithLLM } from './ai.service'
import { fetchNewsForAgent } from './news.service'
import { fetchRecentEmails } from './gmail.service'
import { getGmailAccessToken } from './integrations.service'
import { createMessage } from './messages.service'
import { createAppointment } from './appointment.service'
import { createTask } from './task.service'
import { resolveOutputDestinations, filterPendingActionsByDestination, type OutputDestination } from '../lib/output-destination'

const DAILY_RUN_LIMIT = 50

const runningAgents = new Set<string>()

type ContextData = {
  news?: unknown[]
  emails?: unknown[]
  emailConnectionMissing?: boolean
}

async function gatherContext(
  db: PrismaClient,
  userId: string,
  agentId: string,
  sources: string[],
  env: Env
): Promise<ContextData> {
  const result: ContextData = {}

  const toolNames = sources
  const agentTools = await db.agentTool.findMany({
    where: { agentId, enabled: true },
  })
  const enabledToolNames = new Set(agentTools.map((t) => t.toolName))

  const hasNews = enabledToolNames.has('news_read') || sources.some((s) => s === 'hn' || s.startsWith('r/'))
  if (hasNews) {
    const newsSources = sources.length > 0 ? sources : ['hn']
    try {
      result.news = await fetchNewsForAgent(newsSources, [], 15)
    } catch {
      console.error('[runner] news fetch failed')
    }
  }

  const hasEmail = enabledToolNames.has('email_read')
  if (hasEmail) {
    const accessToken = await getGmailAccessToken(db, userId, env)
    if (!accessToken) {
      result.emailConnectionMissing = true
    } else {
      try {
        result.emails = await fetchRecentEmails(accessToken, 24)
      } catch {
        console.error('[runner] gmail fetch failed')
      }
    }
  }

  return result
}

/**
 * One record an output destination actually wrote.
 *
 * `destination` is the surface the row landed on, which is not always the one
 * that was configured: the calendar destination falls back to a note when the
 * output carries no date, and says so via `fallbackFrom`.
 */
type OutputRecord = {
  destination: OutputDestination
  id: string
  title: string
  /** Set when this row satisfies a different destination than the one configured. */
  fallbackFrom?: OutputDestination
}

type WriteOutputResult = {
  /** Destinations configured on the agent, in write order. */
  destinations: OutputDestination[]
  /** One entry per row written, across every destination. */
  records: OutputRecord[]
  /**
   * Pending actions a destination already materialised. They are withheld from
   * `RunResult.pendingActions` so the approval modal cannot create a second copy.
   */
  consumed: PendingAction[]
}

const CALENDAR_COLOR = '#8b5cf6'

/** First meaningful line of the output, used as a note/appointment title. */
function titleFromOutput(agentName: string, text: string): string {
  const line = text
    .split('\n')
    .map((value) => value.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim())
    .find((value) => value.length > 0)
  if (!line) return `${agentName} update`
  return line.length > 80 ? `${line.slice(0, 77)}...` : line
}

/**
 * Persist a run's output on every surface the agent's `output` column names.
 *
 * Writes are ordered and fail fast: the first destination that throws aborts the
 * rest, and the caller reports the run as failed. Each row carries the surface it
 * actually landed on, so the caller can never be told "inbox" for a calendar entry.
 *
 * @param db - Prisma client used for the writes
 * @param userId - Owner of the output
 * @param agentId - Agent the output belongs to
 * @param outputTypes - The agent's `output` column
 * @param aiText - Output text, with machine marker lines already stripped
 * @param agentName - Agent name, used in inbox message titles
 * @param actions - Parsed marker actions, read for dated calendar events
 * @returns Per-destination records plus the actions already written
 */
async function writeOutput(
  db: PrismaClient,
  userId: string,
  agentId: string,
  outputTypes: readonly string[],
  aiText: string,
  agentName: string,
  actions: PendingAction[]
): Promise<WriteOutputResult> {
  const destinations = resolveOutputDestinations(outputTypes)
  const records: OutputRecord[] = []
  const consumed: PendingAction[] = []
  const wroteNotes = { value: false }

  const writeNote = async (title: string, fallbackFrom?: OutputDestination) => {
    const task = await createTask(db, userId, {
      title,
      text: aiText,
      priority: 'medium',
      dueDate: null,
    })
    records.push({
      destination: 'notes',
      id: task.id,
      title,
      ...(fallbackFrom ? { fallbackFrom } : {}),
    })
    wroteNotes.value = true
  }

  for (const destination of destinations) {
    if (destination === 'inbox') {
      const message = await createMessage(db, userId, agentId, `${agentName} output`, aiText)
      records.push({ destination: 'inbox', id: message.id, title: message.title })
      continue
    }

    if (destination === 'notes') {
      await writeNote(titleFromOutput(agentName, aiText))
      continue
    }

    const dated = actions.filter((action) => action.kind === 'event' && action.date)
    if (dated.length === 0) {
      // Nothing to schedule. Writing an undated event would put a phantom row on
      // the calendar, so the output becomes a note instead — unless the notes
      // destination already wrote this same text, in which case it is covered.
      if (!wroteNotes.value) {
        await writeNote(titleFromOutput(agentName, aiText), 'calendar')
      }
      continue
    }

    for (const event of dated) {
      const appointment = await createAppointment(db, userId, {
        kind: 'appointment',
        title: event.title,
        date: event.date!,
        startTime: event.startTime ?? '09:00',
        endTime: event.endTime ?? null,
        color: CALENDAR_COLOR,
        notes: event.note ?? '',
      })
      records.push({ destination: 'calendar', id: appointment.id, title: event.title })
      consumed.push(event)
    }
  }

  return { destinations, records, consumed }
}

export type RunResult = {
  runId: string
  status: 'success' | 'failed'
  /** Destinations configured on the agent, in write order. */
  destinations: OutputDestination[]
  /** Every row written, across all destinations. Never inferred from `output`. */
  output: RunOutputRecord[]
  pendingActions?: PendingAction[]
  sideEffects?: Array<{
    kind: 'note' | 'calendar' | 'email'
    status: 'created' | 'drafted' | 'blocked'
    title?: string
    id?: string
  }>
  tokensUsed: number
  durationMs: number
  error?: string
}

/** A row an output destination wrote, as reported to the client. */
export type RunOutputRecord = {
  destination: OutputDestination
  id: string
  title: string
  /** Set when the row satisfies a different destination than the one configured. */
  fallbackFrom?: OutputDestination
}

export type RunListItem = {
  runId: string
  status: string
  message?: string
  sideEffects?: string[]
  tokensUsed: number
  durationMs: number
  error?: string
  startedAt: string
}

function toRunListItem(run: {
  id: string
  status: string
  outputSnap: string | null
  tokensUsed: number
  error: string | null
  startedAt: Date
  finishedAt: Date | null
}): RunListItem {
  return {
    runId: run.id,
    status: run.status,
    message: run.outputSnap ?? undefined,
    sideEffects: [],
    tokensUsed: run.tokensUsed,
    durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : 0,
    error: run.error ?? undefined,
    startedAt: run.startedAt.toISOString(),
  }
}

export async function runAgent(
  db: PrismaClient,
  userId: string,
  agentId: string,
  env: Env
): Promise<RunResult> {
  const started = Date.now()
  if (runningAgents.has(agentId)) {
    throw new AppError('CONFLICT', 'This agent is already running.', 409)
  }

  const todayCount = await db.agentRun.count({
    where: {
      userId,
      startedAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  })
  if (todayCount >= DAILY_RUN_LIMIT) {
    throw new AppError('RATE_LIMIT', 'Daily run limit reached (50).', 429)
  }

  const agent = await db.agent.findFirst({
    where: { id: agentId, userId },
    include: { modelKey: true, tools: true },
  })
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.', 404)

  let apiKey = env.OPENROUTER_API_KEY
  let baseUrl = DEFAULT_BASE_URL
  let model = FALLBACK_MODEL
  let provider: string | undefined

  if (agent.modelKey) {
    provider = agent.modelKey.provider
    apiKey = await decrypt(agent.modelKey.apiKeyEnc, env.MODEL_KEY_ENCRYPTION_KEY)
    // Resolve from the key's own provider. Falling back to OpenRouter here sent
    // every non-OpenRouter key to openrouter.ai, which is why DeepSeek never
    // showed a request on its dashboard.
    baseUrl = resolveBaseUrl(provider, agent.modelKey.baseUrl)
    if (agent.modelKey.defaultModel) model = agent.modelKey.defaultModel
  }

  if (!apiKey) {
    throw new AppError(
      'NO_API_KEY',
      'No API key available. Add a model key or set OPENROUTER_API_KEY.',
      400
    )
  }

  runningAgents.add(agentId)

  const run = await db.agentRun.create({
    data: {
      userId,
      agentId,
      status: 'running',
      startedAt: new Date(),
      inputSnap: JSON.stringify({ agentId, model, sources: agent.sources }),
    },
  })

  try {
    const contextData = await gatherContext(db, userId, agentId, agent.sources, env)

    if (contextData.emailConnectionMissing) {
      const explanation =
        'This agent needs Gmail, but no Google account is connected. ' +
        'Open the agent, choose Connect Gmail, then run it again.'
      const written = await writeOutput(
        db,
        userId,
        agentId,
        agent.output,
        explanation,
        agent.name,
        []
      )
      await db.agentRun.update({
        where: { id: run.id },
        data: { status: 'success', outputSnap: explanation, finishedAt: new Date() },
      })
      await db.agent.update({
        where: { id: agentId },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      })
      return {
        runId: run.id,
        status: 'success',
        destinations: written.destinations,
        output: written.records,
        tokensUsed: 0,
        durationMs: Date.now() - started,
      }
    }

    const systemPrompt = buildSystemPrompt({
      name: agent.name,
      role: agent.role,
      description: agent.description,
      prompt: agent.prompt,
      sources: agent.sources,
      output: agent.output,
      preferences: agent.preferences,
    })

    const userPrompt = buildUserPrompt(
      { name: agent.name, role: agent.role },
      contextData
    )

    const result = await generateWithLLM({
      apiKey,
      provider,
      baseUrl,
      model,
      systemPrompt,
      userPrompt,
      maxOutputTokens: agent.maxTokens,
    })

    const aiText = result.text || JSON.stringify(result.object || '')
    const tokensUsed = ((result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0))

    const pendingActions = parseActionItems(aiText)
    const cleanedText = stripActionLines(aiText)

    const written = await writeOutput(
      db,
      userId,
      agentId,
      agent.output,
      cleanedText,
      agent.name,
      pendingActions
    )

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        outputSnap: aiText,
        tokensUsed,
        finishedAt: new Date(),
      },
    })

    await db.agent.update({
      where: { id: agentId },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
      },
    })

    // Two filters, because the marker contract is appended to every system
    // prompt regardless of `output`. Events the calendar destination already
    // wrote are withheld so the approval modal cannot duplicate them, and the
    // rest are withheld when the agent was not configured for the surface they
    // would land on. Without the second filter an inbox-only agent was offered
    // every [TASK]/[NOTE] line the model happened to write.
    const proposed = filterPendingActionsByDestination(pendingActions, agent.output)
    const remaining = proposed.filter((action) => !written.consumed.includes(action))

    return {
      runId: run.id,
      status: 'success',
      destinations: written.destinations,
      output: written.records,
      ...(remaining.length > 0 ? { pendingActions: remaining } : {}),
      tokensUsed,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: errorMsg,
        finishedAt: new Date(),
      },
    })

    return {
      runId: run.id,
      status: 'failed',
      destinations: [],
      output: [],
      tokensUsed: 0,
      durationMs: Date.now() - started,
      error: errorMsg,
    }
  } finally {
    runningAgents.delete(agentId)
  }
}

export async function getAgentRun(db: PrismaClient, userId: string, runId: string): Promise<RunListItem> {
  const run = await db.agentRun.findFirst({
    where: { id: runId, userId },
  })
  if (!run) throw new AppError('NOT_FOUND', 'Run not found.', 404)
  return toRunListItem(run)
}

export async function listAgentRuns(
  db: PrismaClient,
  userId: string,
  opts: { offset?: number; limit?: number; agentId?: string }
): Promise<{ runs: RunListItem[]; hasMore: boolean }> {
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 20

  const where = {
    userId,
    ...(opts.agentId ? { agentId: opts.agentId } : {}),
  }

  const [runs, total] = await Promise.all([
    db.agentRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    db.agentRun.count({ where }),
  ])

  return { runs: runs.map(toRunListItem), hasMore: offset + limit < total }
}
