import { api } from '../lib/api'
import type { OutputType } from './agents.repository'

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
  /** Destinations a new agent starts with. A set, like `Agent.output`. */
  defaultOutput: OutputType[]
  configSchema?: Record<string, unknown> | null
  sortOrder: number
}

export async function listTemplates(): Promise<AgentTemplateDto[]> {
  return api<AgentTemplateDto[]>('/api/templates')
}
