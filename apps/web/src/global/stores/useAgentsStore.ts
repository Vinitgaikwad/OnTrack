import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'

export type Agent = {
  id: string
  name: string
  role: string
  icon: string
  color: string
  description: string
  preferences: string[]
  enabled: boolean
}

type AgentsStore = {
  agents: Agent[]
  addAgent: (agent: Omit<Agent, 'id'>) => void
  updateAgent: (id: string, patch: Partial<Omit<Agent, 'id'>>) => void
  removeAgent: (id: string) => void
}

const seed = (): Agent[] => [
  {
    id: uid(),
    name: 'Focus Coach',
    role: 'Coach',
    icon: 'brain',
    color: '#8e4ec6',
    description: 'Keeps sessions short, celebrates every finished block.',
    preferences: ['Celebrates wins', 'Suggests breaks'],
    enabled: true,
  },
  {
    id: uid(),
    name: 'Reminder Buddy',
    role: 'Reminder',
    icon: 'bell',
    color: '#0e7490',
    description: 'Nudges gently and repeats until you actually do the thing.',
    preferences: ['Gently nags', 'Repeats reminders'],
    enabled: true,
  },
]

export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set) => ({
      agents: seed(),
      addAgent: (agent) => set((state) => ({ agents: [...state.agents, { ...agent, id: uid() }] })),
      updateAgent: (id, patch) =>
        set((state) => ({
          agents: state.agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)),
        })),
      removeAgent: (id) =>
        set((state) => ({ agents: state.agents.filter((agent) => agent.id !== id) })),
    }),
    { name: 'ontrack-agents' }
  )
)