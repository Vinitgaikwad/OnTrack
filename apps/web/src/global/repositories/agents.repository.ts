import { api } from '../lib/api'

export type AgentDto = {
  id: string
  templateId?: string | null
  name: string
  role: string
  icon: string
  color: string
  description: string
  preferences: string[]
  enabled: boolean
  triggerType: 'manual' | 'schedule'
  sources: string[]
  output: 'message' | 'note' | 'email'
  prompt?: string | null
  draftOnly: boolean
  modelKeyId?: string | null
  maxTokens: number
  lastRunAt?: string | null
  runCount: number
  createdAt: string
  updatedAt: string
  tools?: AgentToolDto[]
}

export type AgentToolDto = {
  id: string
  agentId: string
  toolName: string
  enabled: boolean
  config?: Record<string, unknown> | null
}

export type CreateAgentInput = {
  name: string
  role: string
  icon: string
  color: string
  description: string
  preferences?: string[]
  templateId?: string
  sources?: string[]
  output?: 'message' | 'note' | 'email'
  draftOnly?: boolean
  modelKeyId?: string
  maxTokens?: number
}

export type AgentActionItem = {
  kind: 'task' | 'event' | 'note'
  title: string
  date?: string
  startTime?: string
  endTime?: string | null
  note?: string
}

/**
 * One row of an agent's run history.
 *
 * Distinct from {@link RunResultDto}: the list endpoint flattens the output
 * snapshot to a `message` string and adds `startedAt`, so the two shapes cannot
 * share one type.
 */
export type AgentRunDto = {
  runId: string
  status: string
  /** The `outputSnap` text, not an output record. */
  message?: string
  sideEffects?: string[]
  tokensUsed: number
  durationMs: number
  error?: string
  startedAt: string
}

/**
 * Where a run's output was written.
 *
 * Mirrors the backend `OutputDestination`. Never infer this from `message` being
 * present — a diary entry also produces a message object.
 */
export type OutputDestination = 'inbox' | 'diary' | 'none'

export type RunResultDto = {
  runId: string
  status: string
  destination?: OutputDestination
  message?: { id: string; title: string; body: string }
  pendingActions?: AgentActionItem[]
  sideEffects?: string[]
  tokensUsed: number
  durationMs: number
  error?: string
}

export async function listAgents(): Promise<AgentDto[]> {
  return api<AgentDto[]>('/api/agents')
}

export async function getAgent(id: string): Promise<AgentDto> {
  return api<AgentDto>(`/api/agents/${encodeURIComponent(id)}`)
}

export async function createAgent(input: CreateAgentInput): Promise<AgentDto> {
  return api<AgentDto>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAgent(
  id: string,
  patch: Partial<Omit<AgentDto, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<AgentDto> {
  return api<AgentDto>(`/api/agents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteAgent(id: string): Promise<void> {
  await api<void>(`/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function runAgent(id: string): Promise<RunResultDto> {
  return api<RunResultDto>(`/api/agents/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  })
}

export type ConfirmActionResponse = {
  created: Array<{ kind: AgentActionItem['kind']; id: string }>
}

export async function confirmActionItems(items: AgentActionItem[]): Promise<ConfirmActionResponse> {
  return api<ConfirmActionResponse>('/api/agents/actions', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

export async function listRuns(agentId: string, limit?: number): Promise<AgentRunDto[]> {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api<AgentRunDto[]>(`/api/agents/${encodeURIComponent(agentId)}/runs${qs}`)
}

export async function listAgentTools(agentId: string): Promise<AgentToolDto[]> {
  return api<AgentToolDto[]>(`/api/tools/agents/${encodeURIComponent(agentId)}/tools`)
}

export async function updateAgentTool(
  agentId: string,
  toolName: string,
  patch: { enabled?: boolean; config?: Record<string, unknown> | null }
): Promise<AgentToolDto> {
  return api<AgentToolDto>(
    `/api/tools/agents/${encodeURIComponent(agentId)}/tools/${encodeURIComponent(toolName)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  )
}
