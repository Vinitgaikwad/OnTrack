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

async function formatOutput(
  db: PrismaClient,
  userId: string,
  agentId: string,
  outputType: string,
  aiText: string,
  agentName: string
): Promise<{ id: string; title: string; body: string } | null> {
  if (outputType === 'message' || outputType === 'email') {
    const message = await createMessage(db, userId, agentId, `${agentName} output`, aiText)
    return { id: message.id, title: message.title, body: message.body }
  }

  if (outputType === 'note') {
    const today = new Date().toISOString().slice(0, 10)
    const entry = await db.diaryEntry.create({
      data: {
        userId,
        title: `${agentName} — ${today}`,
        content: aiText,
        mood: 'good',
        tags: ['agent-output'],
        date: today,
        hidden: false,
      },
    })
    return {
      id: entry.id,
      title: `${agentName} — ${today}`,
      body: aiText,
    }
  }

  return null
}

export type RunResult = {
  runId: string
  status: 'success' | 'failed'
  message?: { id: string; title: string; body: string }
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
  if (!agent.enabled) throw new AppError('BAD_REQUEST', 'Agent is disabled.', 400)

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
      const noticeId = await formatOutput(
        db,
        userId,
        agentId,
        agent.output,
        explanation,
        agent.name
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
        ...(noticeId ? { message: noticeId } : {}),
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

    const messageId = await formatOutput(db, userId, agentId, agent.output, cleanedText, agent.name)

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

    return {
      runId: run.id,
      status: 'success',
      ...(messageId
        ? { message: { id: messageId.id, title: messageId.title, body: messageId.body } }
        : {}),
      ...(pendingActions.length > 0 ? { pendingActions } : {}),
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
