import { api } from '../lib/api'

export type AgentMessageDto = {
  id: string
  agentId: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export type ListMessagesOpts = {
  offset?: number
  limit?: number
  unread?: boolean
}

export async function listMessages(
  opts: ListMessagesOpts = {}
): Promise<{ messages: AgentMessageDto[]; hasMore: boolean }> {
  const params = new URLSearchParams()
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.unread !== undefined) params.set('unread', String(opts.unread))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api<{ messages: AgentMessageDto[]; hasMore: boolean }>(
    `/api/agents/messages${qs}`
  )
}

export async function markRead(id: string): Promise<AgentMessageDto> {
  return api<AgentMessageDto>(`/api/agents/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ read: true }),
  })
}

export async function deleteMessage(id: string): Promise<void> {
  await api<void>(`/api/agents/messages/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
