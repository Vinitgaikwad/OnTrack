import { useEffect, useState } from 'react'
import { Bot, Brain, Bell, CalendarClock, Coffee, Feather, Inbox, Mail, Newspaper, Plus, Puzzle, Search, ShieldCheck, Sparkles, Trash2, Zap, Play, Loader2, Clock } from 'lucide-react'
import type { Agent, AgentTemplate } from '../../global/stores/useAgentsStore'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import { useAgentMessagesStore } from '../../global/stores/useAgentMessagesStore'
import { AgentEditor } from './AgentEditor'
import { TemplateGallery } from './TemplateGallery'
import { AgentInbox } from './AgentInbox'
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
  mail: Mail,
  search: Search,
  newspaper: Newspaper,
} as const

export type AgentIconKey = keyof typeof AGENT_ICONS

export const AGENT_COLORS = ['#8e4ec6', '#0e7490', '#e5484d', '#2f9e63', '#d6409f', '#e8a33d', '#3b6ef6'] as const

function timeAgo(date: string | null | undefined): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentsPage() {
  const agents = useAgentsStore((state) => state.agents)
  const loadStatus = useAgentsStore((state) => state.loadStatus)
  const templatesLoadStatus = useAgentsStore((state) => state.templatesLoadStatus)
  const ensureLoaded = useAgentsStore((state) => state.ensureLoaded)
  const ensureTemplatesLoaded = useAgentsStore((state) => state.ensureTemplatesLoaded)
  const deleteAgent = useAgentsStore((state) => state.deleteAgent)
  const updateAgent = useAgentsStore((state) => state.updateAgent)
  const runAgent = useAgentsStore((state) => state.runAgent)
  const runningAgentId = useAgentsStore((state) => state.runningAgentId)

  const unreadCount = useAgentMessagesStore((state) => state.unreadCount)

  const [tab, setTab] = useState<'agents' | 'inbox'>('agents')
  const [editing, setEditing] = useState<Agent | null>(null)
  const [templateForEditor, setTemplateForEditor] = useState<AgentTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    void ensureLoaded()
    void ensureTemplatesLoaded()
  }, [ensureLoaded, ensureTemplatesLoaded])

  const isLoading = loadStatus === 'idle' || loadStatus === 'loading'
  const templatesLoading = templatesLoadStatus === 'idle' || templatesLoadStatus === 'loading'
  const showEmpty = !isLoading && agents.length === 0
  const showGallery = showEmpty && !templatesLoading

  const handleUseTemplate = (template: AgentTemplate) => {
    setTemplateForEditor(template)
    setEditing(null)
    setCreating(false)
  }

  const handleNewAgent = () => {
    setTemplateForEditor(null)
    setEditing(null)
    setCreating(true)
  }

  const closeEditor = () => {
    setEditing(null)
    setTemplateForEditor(null)
    setCreating(false)
  }

  const confirmDelete = (agent: Agent) => {
    if (deletingId === agent.id) {
      deleteAgent(agent.id)
      setDeletingId(null)
    } else {
      setDeletingId(agent.id)
      setTimeout(() => setDeletingId(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-(--text-muted)">Loading agents...</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex min-w-0 flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-(--surface-2)" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-(--surface-2)" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-(--surface-2)" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-(--surface-2)" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-(--surface-2)" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-(--text-muted)">
            Little helpers you can shape. Give each one a name, a job, and preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-(--border) bg-(--surface) p-1">
            <button
              onClick={() => setTab('agents')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === 'agents' ? 'bg-(--accent-soft) text-(--accent)' : 'text-(--text-muted) hover:text-(--text)'
              }`}
            >
              <Bot size={15} />
              Agents
            </button>
            <button
              onClick={() => setTab('inbox')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === 'inbox' ? 'bg-(--accent-soft) text-(--accent)' : 'text-(--text-muted) hover:text-(--text)'
              }`}
            >
              <Inbox size={15} />
              Inbox
              {unreadCount > 0 ? (
                <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-(--accent) px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>
          </div>
          {tab === 'agents' ? (
            <Button onClick={handleNewAgent}>
              <Plus size={16} />
              New agent
            </Button>
          ) : null}
        </div>
      </header>

      {tab === 'inbox' ? <AgentInbox /> : (
        <>
          {showGallery ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Choose a template</h2>
                <Button variant="ghost" size="sm" onClick={handleNewAgent}>
                  Skip — start from scratch
                </Button>
              </div>
              <TemplateGallery onSelect={handleUseTemplate} />
            </>
          ) : agents.length === 0 ? null : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const Icon = AGENT_ICONS[agent.icon as AgentIconKey] ?? Bot
                const isRunning = runningAgentId === agent.id
                const isAnotherRunning = runningAgentId !== null && !isRunning

                return (
                  <Card key={agent.id} className="flex min-w-0 flex-col p-5">
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
                        <IconButton icon={Puzzle} label="Edit agent" onClick={() => { setTemplateForEditor(null); setEditing(agent) }} />
                        <IconButton
                          icon={Trash2}
                          label={deletingId === agent.id ? 'Click again to confirm' : 'Delete agent'}
                          onClick={() => confirmDelete(agent)}
                          className={deletingId === agent.id ? 'text-(--danger)' : ''}
                        />
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 flex-1 text-sm text-(--text-muted)">{agent.description}</p>

                    {agent.tools && agent.tools.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {agent.tools.filter((t) => t.enabled).slice(0, 4).map((tool) => (
                          <span
                            key={tool.id}
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-(--surface-2) text-(--text-muted)"
                          >
                            {tool.toolName}
                          </span>
                        ))}
                        {agent.tools.filter((t) => t.enabled).length > 4 ? (
                          <span className="rounded-full px-2 py-0.5 text-[11px] text-(--text-muted)">
                            +{agent.tools.filter((t) => t.enabled).length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : agent.preferences.length > 0 ? (
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

                    <div className="mt-3 flex items-center gap-2 text-[11px] text-(--text-muted)">
                      <Clock size={12} />
                      <span>Last run: {timeAgo(agent.lastRunAt)}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2">
                        <button
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
                        </button>
                        <span className="text-xs text-(--text-muted)">{agent.enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>

                      <Button
                        size="sm"
                        disabled={isAnotherRunning}
                        onClick={() => runAgent(agent.id)}
                      >
                        {isRunning ? (
                          <><Loader2 size={14} className="animate-spin" /> Running</>
                        ) : (
                          <><Play size={14} /> Run</>
                        )}
                      </Button>
                    </div>
                  </Card>
                )
              })}

              <Card
                className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 p-5 transition hover:border-(--accent)"
                onClick={handleNewAgent}
              >
                <Plus size={24} className="text-(--text-muted)" />
                <p className="text-sm font-medium text-(--text-muted)">New agent</p>
              </Card>
            </div>
          )}

          <AgentEditor
            key={editing?.id ?? templateForEditor?.id ?? 'new'}
            open={editing !== null || templateForEditor !== null || creating}
            initial={editing}
            template={templateForEditor}
            onClose={closeEditor}
            onSave={closeEditor}
          />
        </>
      )}
    </div>
  )
}
