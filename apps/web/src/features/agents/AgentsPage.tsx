import { useState } from 'react'
import { Bot, Brain, Bell, CalendarClock, Coffee, Feather, Plus, Puzzle, ShieldCheck, Sparkles, Trash2, Zap } from 'lucide-react'
import type { Agent } from '../../global/stores/useAgentsStore'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import { AgentEditor } from './AgentEditor'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'
import { IconButton } from '../../global/ui/IconButton'

export const AGENT_ICONS = {
  brain: Brain,
  bell: Bell,
  zap: Zap,
  sparkles: Sparkles,
  puzzle: Puzzle,
  feather: Feather,
  shield: ShieldCheck,
  coffee: Coffee,
  clock: CalendarClock,
} as const

export type AgentIconKey = keyof typeof AGENT_ICONS

export const AGENT_COLORS = ['#8e4ec6', '#0e7490', '#e5484d', '#2f9e63', '#d6409f', '#e8a33d', '#3b6ef6'] as const

export function AgentsPage() {
  const agents = useAgentsStore((state) => state.agents)
  const addAgent = useAgentsStore((state) => state.addAgent)
  const updateAgent = useAgentsStore((state) => state.updateAgent)
  const removeAgent = useAgentsStore((state) => state.removeAgent)

  const [editing, setEditing] = useState<Agent | 'new' | null>(null)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-(--text-muted)">
            Little helpers you can shape. Give each one a name, a job, and preferences.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          New agent
        </Button>
      </header>

      {agents.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-14 text-center">
          <Bot size={40} className="text-(--text-muted)" />
          <p className="text-sm text-(--text-muted)">
            No agents yet. Create one to give your ADHD a friendly co-pilot.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const Icon = AGENT_ICONS[agent.icon as AgentIconKey] ?? Bot
            return (
              <Card key={agent.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
                    style={{
                      backgroundColor: 'color-mix(in srgb, ' + agent.color + ' 18%, transparent)',
                      color: agent.color,
                    }}
                  >
                    <Icon size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{agent.name}</h2>
                    <p className="text-xs font-medium" style={{ color: agent.color }}>
                      {agent.role}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton icon={Puzzle} label="Edit agent" onClick={() => setEditing(agent)} />
                    <IconButton icon={Trash2} label="Delete agent" onClick={() => removeAgent(agent.id)} />
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-(--text-muted)">{agent.description}</p>
                {agent.preferences.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {agent.preferences.map((pref) => (
                      <span
                        key={pref}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: 'color-mix(in srgb, ' + agent.color + ' 12%, transparent)',
                          color: agent.color,
                        }}
                      >
                        {pref}
                      </span>
                    ))}
                  </div>
                ) : null}
                <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-(--surface-2) px-3 py-2">
                  <span className="text-xs font-medium text-(--text-muted)">Enabled</span>
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={() => updateAgent(agent.id, { enabled: !agent.enabled })}
                    className="peer sr-only"
                  />
                  <span
                    onClick={() => updateAgent(agent.id, { enabled: !agent.enabled })}
                    className={`relative h-5 w-9 rounded-full transition ${
                      agent.enabled ? 'bg-(--success)' : 'bg-(--border-strong)'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        agent.enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </label>
              </Card>
            )
          })}
        </div>
      )}

      <AgentEditor
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        open={editing !== null}
        initial={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          if (editing && editing !== 'new') {
            updateAgent(editing.id, data)
          } else {
            addAgent(data)
          }
          setEditing(null)
        }}
      />
    </div>
  )
}