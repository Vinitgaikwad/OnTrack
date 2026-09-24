import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isAuthError, toErrorMessage } from '../lib/api'
import {
  createAgent as createAgentReq,
  deleteAgent as deleteAgentReq,
  listAgents as listAgentsReq,
  listAgentTools,
  runAgent as runAgentReq,
  updateAgent as updateAgentReq,
  type AgentDto,
  type AgentToolDto,
  type CreateAgentInput,
  type RunResultDto,
} from '../repositories/agents.repository'
import {
  listTemplates as listTemplatesReq,
  type AgentTemplateDto,
} from '../repositories/templates.repository'
import { useToastStore } from './useToastStore'

export type Agent = {
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
  draftOnly: boolean
  modelKeyId?: string | null
  maxTokens: number
  lastRunAt?: string | null
  runCount: number
  createdAt: string
  updatedAt: string
  tools?: AgentTool[]
}

export type AgentTool = {
  id: string
  agentId: string
  toolName: string
  enabled: boolean
  config?: Record<string, unknown> | null
}

export type AgentTemplate = {
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

export type RunResult = {
  runId: string
  status: string
  message?: string
  sideEffects?: string[]
  tokensUsed: number
  durationMs: number
  error?: string
}

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

type AgentsStore = {
  agents: Agent[]
  templates: AgentTemplate[]
  loadStatus: LoadStatus
  templatesLoadStatus: LoadStatus
  epoch: number
  runningAgentId: string | null
  ensureLoaded: () => Promise<void>
  ensureTemplatesLoaded: () => Promise<void>
  createAgent: (input: CreateAgentInput) => Promise<void>
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  runAgent: (id: string) => Promise<RunResult>
  setRunningAgent: (id: string | null) => void
}

const toAgent = (dto: AgentDto): Agent => ({
  id: dto.id,
  templateId: dto.templateId,
  name: dto.name,
  role: dto.role,
  icon: dto.icon,
  color: dto.color,
  description: dto.description,
  preferences: dto.preferences,
  enabled: dto.enabled,
  triggerType: dto.triggerType,
  sources: dto.sources,
  output: dto.output,
  draftOnly: dto.draftOnly,
  modelKeyId: dto.modelKeyId,
  maxTokens: dto.maxTokens,
  lastRunAt: dto.lastRunAt,
  runCount: dto.runCount,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  tools: dto.tools,
})

const toTemplate = (dto: AgentTemplateDto): AgentTemplate => ({
  id: dto.id,
  slug: dto.slug,
  name: dto.name,
  description: dto.description,
  category: dto.category,
  icon: dto.icon,
  requiresOAuth: dto.requiresOAuth,
  defaultRole: dto.defaultRole,
  defaultPrompt: dto.defaultPrompt,
  defaultSources: dto.defaultSources,
  defaultTools: dto.defaultTools,
  defaultOutput: dto.defaultOutput,
  configSchema: dto.configSchema,
  sortOrder: dto.sortOrder,
})

function pushSyncError(error: unknown): void {
  if (isAuthError(error)) return
  useToastStore.getState().push({
    title: "Couldn't sync agents",
    message: toErrorMessage(error),
    level: 'error',
  })
}

export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set, get) => ({
      agents: [],
      templates: [],
      loadStatus: 'idle',
      templatesLoadStatus: 'idle',
      epoch: 0,
      runningAgentId: null,

      ensureLoaded: async () => {
        const { loadStatus } = get()
        if (loadStatus === 'loading' || loadStatus === 'loaded') return
        set({ loadStatus: 'loading' })
        try {
          const epoch = get().epoch
          const dtos = await listAgentsReq()
          if (get().epoch !== epoch) return
          const toolsMap = new Map<string, AgentToolDto[]>()
          const agents = await Promise.all(
            dtos.map(async (dto) => {
              try {
                const tools = await listAgentTools(dto.id)
                toolsMap.set(dto.id, tools)
              } catch {
                // tools are optional, continue without them
              }
              return toAgent({ ...dto, tools: toolsMap.get(dto.id) ?? dto.tools })
            })
          )
          if (get().epoch !== epoch) return
          set({ agents, loadStatus: 'loaded' })
        } catch (error) {
          if (get().loadStatus === 'loading') set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      ensureTemplatesLoaded: async () => {
        if (get().templates.length > 0) return
        if (get().templatesLoadStatus === 'loading') return
        set({ templatesLoadStatus: 'loading' })
        try {
          const dtos = await listTemplatesReq()
          set({ templates: dtos.map(toTemplate), templatesLoadStatus: 'loaded' })
        } catch (error) {
          set({ templatesLoadStatus: 'error' })
          pushSyncError(error)
        }
      },

      createAgent: async (input) => {
        const optimistic: Agent = {
          id: `pending-${Date.now().toString(36)}`,
          templateId: input.templateId ?? null,
          name: input.name,
          role: input.role,
          icon: input.icon,
          color: input.color,
          description: input.description,
          preferences: input.preferences ?? [],
          enabled: true,
          triggerType: 'manual',
          sources: input.sources ?? [],
          output: input.output ?? 'message',
          draftOnly: input.draftOnly ?? false,
          modelKeyId: input.modelKeyId ?? null,
          maxTokens: input.maxTokens ?? 4096,
          lastRunAt: null,
          runCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tools: [],
        }
        set((state) => ({
          agents: [...state.agents, optimistic],
          epoch: state.epoch + 1,
        }))
        try {
          const dto = await createAgentReq(input)
          set((state) => ({
            agents: state.agents.map((a) => (a.id === optimistic.id ? toAgent(dto) : a)),
          }))
        } catch (error) {
          pushSyncError(error)
          set((state) => ({
            agents: state.agents.filter((a) => a.id !== optimistic.id),
          }))
          void refreshAgents(set, get)
        }
      },

      updateAgent: async (id, patch) => {
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          epoch: state.epoch + 1,
        }))
        try {
          await updateAgentReq(id, patch)
        } catch (error) {
          pushSyncError(error)
          void refreshAgents(set, get)
        }
      },

      deleteAgent: async (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          epoch: state.epoch + 1,
        }))
        try {
          await deleteAgentReq(id)
        } catch (error) {
          pushSyncError(error)
          void refreshAgents(set, get)
        }
      },

      runAgent: async (id) => {
        set({ runningAgentId: id })
        try {
          const result: RunResultDto = await runAgentReq(id)
          set((state) => ({
            runningAgentId: null,
            agents: state.agents.map((a) =>
              a.id === id
                ? { ...a, lastRunAt: new Date().toISOString(), runCount: a.runCount + 1 }
                : a
            ),
          }))
          return {
            runId: result.runId,
            status: result.status,
            message: result.message,
            sideEffects: result.sideEffects,
            tokensUsed: result.tokensUsed,
            durationMs: result.durationMs,
            error: result.error,
          }
        } catch (error) {
          set({ runningAgentId: null })
          pushSyncError(error)
          throw error
        }
      },

      setRunningAgent: (id) => set({ runningAgentId: id }),
    }),
    {
      name: 'ontrack-agents',
      partialize: (state) => ({ agents: state.agents, templates: state.templates }),
    }
  )
)

async function refreshAgents(
  set: (state: Partial<AgentsStore & { epoch: number }>) => void,
  get: () => AgentsStore & { epoch: number }
): Promise<void> {
  const savedEpoch = get().epoch
  try {
    const dtos = await listAgentsReq()
    if (get().epoch !== savedEpoch) return
    const agents = dtos.map(toAgent)
    if (get().epoch === savedEpoch) set({ agents, loadStatus: 'loaded' })
  } catch (error) {
    pushSyncError(error)
  }
}
