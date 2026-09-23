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
  prompt?: string
  sources?: string[]
  output?: 'message' | 'note' | 'email'
  draftOnly?: boolean
  modelKeyId?: string
  maxTokens?: number
}

export type RunResultDto = {
  runId: string
  status: string
  message?: string
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

export async function listRuns(agentId: string, limit?: number): Promise<RunResultDto[]> {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api<RunResultDto[]>(`/api/agents/${encodeURIComponent(agentId)}/runs${qs}`)
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
