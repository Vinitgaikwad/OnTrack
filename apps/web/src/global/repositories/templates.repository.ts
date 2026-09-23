import { api } from '../lib/api'

export type AgentTemplateDto = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  icon: string
  requiresOAuth?: string | null
  defaultRole: string
  defaultPrompt: string
  defaultSources: string[]
  defaultTools: string[]
  defaultOutput: 'message' | 'note' | 'email'
  configSchema?: Record<string, unknown> | null
  sortOrder: number
}

export async function listTemplates(): Promise<AgentTemplateDto[]> {
  return api<AgentTemplateDto[]>('/api/templates')
}
