import type { PrismaClient } from '../generated/prisma/client'
import type { Env } from '../types'
import { AppError } from '../lib/http'
import { decrypt } from '../lib/crypto'
import { generateWithLLM } from './ai.service'
import { fetchNewsForAgent } from './news.service'
import { fetchRecentEmails } from './gmail.service'
import { createMessage } from './messages.service'

const DAILY_RUN_LIMIT = 50

const runningAgents = new Set<string>()

function buildSystemPrompt(agent: {
  name: string
  role: string
  prompt: string | null
  sources: string[]
  output: string
  preferences: string[]
}): string {
  const parts: string[] = []
  parts.push(`You are "${agent.name}", an AI agent specializing in ${agent.role}.`)
  if (agent.prompt) parts.push(`\nCustom instructions: ${agent.prompt}`)
  if (agent.sources.length > 0) parts.push(`\nData sources: ${agent.sources.join(', ')}`)
  if (agent.preferences.length > 0) parts.push(`\nPreferences: ${agent.preferences.join(', ')}`)
  parts.push(`\nOutput format: ${agent.output}.`)
  parts.push(`\nBe concise, actionable, and structured. When listing items, use bullet points.`)
  return parts.join('')
}

function buildUserPrompt(agent: {
  name: string
  role: string
  prompt: string | null
  sources: string[]
}, contextData: { news?: unknown[]; emails?: unknown[] }): string {
  const parts: string[] = []
  parts.push(`Run the agent "${agent.name}" (${agent.role}).`)
  if (agent.prompt) parts.push(`Task: ${agent.prompt}`)

  if (contextData.news && contextData.news.length > 0) {
    parts.push(`\n--- News data ---`)
    const sliced = contextData.news.slice(0, 20)
    for (const item of sliced) {
      const asRecord = item as Record<string, unknown>
      const title = String(asRecord.title || '')
      const source = String(asRecord.source || '')
      parts.push(`- [${source}] ${title}`)
    }
  }

  if (contextData.emails && contextData.emails.length > 0) {
    parts.push(`\n--- Recent emails ---`)
    const sliced = contextData.emails.slice(0, 15)
    for (const item of sliced) {
      const asRecord = item as Record<string, unknown>
      const subject = String(asRecord.subject || '')
      const from = String(asRecord.from || '')
      const snippet = String(asRecord.snippet || '')
      parts.push(`- From: ${from} | Subject: ${subject} | ${snippet}`)
    }
  }

  return parts.join('')
}

async function gatherContext(
  db: PrismaClient,
  userId: string,
  agentId: string,
  sources: string[],
  env: Env
): Promise<{ news?: unknown[]; emails?: unknown[] }> {
  const result: { news?: unknown[]; emails?: unknown[] } = {}

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
    const integration = await db.integrationAccount.findFirst({
      where: { userId, provider: 'gmail' },
    })
    if (integration && integration.tokenEnc) {
      try {
        const accessToken = await decrypt(integration.tokenEnc, env.INTEGRATION_ENCRYPTION_KEY)
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
  let baseUrl = 'https://openrouter.ai/api/v1'
  let model = 'anthropic/claude-3.5-sonnet'

  if (agent.modelKey) {
    const decryptedKey = await decrypt(agent.modelKey.apiKeyEnc, env.MODEL_KEY_ENCRYPTION_KEY)
    apiKey = decryptedKey
    if (agent.modelKey.baseUrl) baseUrl = agent.modelKey.baseUrl
    if (agent.modelKey.defaultModel) model = agent.modelKey.defaultModel
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

    const systemPrompt = buildSystemPrompt({
      name: agent.name,
      role: agent.role,
      prompt: agent.prompt,
      sources: agent.sources,
      output: agent.output,
      preferences: agent.preferences,
    })

    const userPrompt = buildUserPrompt(
      { name: agent.name, role: agent.role, prompt: agent.prompt, sources: agent.sources },
      contextData
    )

    const result = await generateWithLLM({
      apiKey: apiKey || '',
      baseUrl,
      model,
      systemPrompt,
      userPrompt,
      maxTokens: agent.maxTokens,
    })

    const aiText = result.text || JSON.stringify(result.object || '')
    const tokensUsed = ((result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0))

    const messageId = await formatOutput(db, userId, agentId, agent.output, aiText, agent.name)

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
