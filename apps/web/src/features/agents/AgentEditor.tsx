import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Agent, AgentTemplate } from '../../global/stores/useAgentsStore'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import { useModelKeysStore } from '../../global/stores/useModelKeysStore'
import { useToastStore } from '../../global/stores/useToastStore'
import { AGENT_COLORS, AGENT_ICONS, type AgentIconKey } from './AgentsPage'
import { ModelKeyModal } from './ModelKeyModal'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { MarkdownEditor } from '../../global/ui/MarkdownEditor'

type AgentEditorProps = {
  open: boolean
  initial: Agent | null
  template: AgentTemplate | null
  onClose: () => void
  onSave: () => void
}

const PREFERENCE_SUGGESTIONS = [
  'Celebrates wins',
  'Gently nags',
  'Suggests breaks',
  'Repeats reminders',
  'Keeps it short',
  'Praises effort',
  'Checks in at noon',
  'Tracks mood',
]

const ROLES = ['Coach', 'Reminder', 'Tracker', 'Listener', 'Nagger', 'Summarizer', 'Curator', 'Planner']

type ToolCategory = 'data' | 'communication' | 'productivity' | 'ai'

type ToolDef = {
  id: string
  name: string
  description: string
  category: ToolCategory
  requiresOAuth?: boolean
  oauthProvider?: string
}

const AVAILABLE_TOOLS: ToolDef[] = [
  { id: 'gmail', name: 'Gmail', description: 'Read, search, and summarize emails', category: 'communication', requiresOAuth: true, oauthProvider: 'Gmail' },
  { id: 'calendar', name: 'Calendar', description: 'View and manage events', category: 'productivity', requiresOAuth: true, oauthProvider: 'Google Calendar' },
  { id: 'notes', name: 'Notes', description: 'Create and update notes', category: 'productivity' },
  { id: 'tasks', name: 'Tasks', description: 'Manage task lists and priorities', category: 'productivity' },
  { id: 'diary', name: 'Diary', description: 'Read and write diary entries', category: 'data' },
  { id: 'search', name: 'Web Search', description: 'Search the web for information', category: 'data' },
  { id: 'model', name: 'AI Model', description: 'Use an LLM for reasoning and generation', category: 'ai' },
  { id: 'spreadsheet', name: 'Spreadsheets', description: 'Read and write structured data', category: 'data' },
  { id: 'email-send', name: 'Send Email', description: 'Compose and send emails', category: 'communication' },
  { id: 'notifications', name: 'Notifications', description: 'Push notifications and reminders', category: 'communication' },
]

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  data: 'Data',
  communication: 'Communication',
  productivity: 'Productivity',
  ai: 'AI & Generation',
}

const CATEGORY_ORDER: ToolCategory[] = ['data', 'communication', 'productivity', 'ai']

const OUTPUT_OPTIONS = ['message', 'note', 'email'] as const

export function AgentEditor({ open, initial, template, onClose, onSave }: AgentEditorProps) {
  const createAgent = useAgentsStore((state) => state.createAgent)
  const updateAgent = useAgentsStore((state) => state.updateAgent)
  const keys = useModelKeysStore((state) => state.keys)
  const pushToast = useToastStore((state) => state.push)

  const [name, setName] = useState(initial?.name ?? template?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? template?.defaultRole ?? 'Coach')
  const [icon, setIcon] = useState<AgentIconKey>((initial?.icon as AgentIconKey) ?? (template?.icon as AgentIconKey) ?? 'brain')
  const [color, setColor] = useState(initial?.color ?? AGENT_COLORS[0])
  const [description, setDescription] = useState(
    initial?.description ?? template?.defaultPrompt ?? template?.description ?? ''
  )
  const [preferences, setPreferences] = useState<string[]>(initial?.preferences ?? [])

  const [enabledTools, setEnabledTools] = useState<string[]>(initial?.tools?.map((t) => t.toolName) ?? template?.defaultTools ?? [])
  const [modelKeyId, setModelKeyId] = useState<string>(initial?.modelKeyId ?? '')
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens ?? 2000)
  const [draftOnly, setDraftOnly] = useState(initial?.draftOnly ?? false)
  const [output, setOutput] = useState<string>(initial?.output ?? template?.defaultOutput ?? 'message')

  const [showModelKeyModal, setShowModelKeyModal] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const togglePreference = (pref: string) => {
    setPreferences((current) =>
      current.includes(pref) ? current.filter((p) => p !== pref) : [...current, pref]
    )
  }

  const toggleTool = (toolId: string) => {
    setEnabledTools((current) =>
      current.includes(toolId) ? current.filter((t) => t !== toolId) : [...current, toolId]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return

    if (initial) {
      updateAgent(initial.id, {
        name: name.trim(),
        role,
        icon,
        color,
        description: description.trim(),
        preferences,
        tools: enabledTools.map((toolName) => ({
          id: '',
          agentId: initial.id,
          toolName,
          enabled: true,
          config: null,
        })),
        modelKeyId: modelKeyId || null,
        maxTokens,
        draftOnly,
        output: output as 'message' | 'note' | 'email',
      })
      pushToast({ title: `${name.trim()} updated`, level: 'info' })
    } else {
      createAgent({
        name: name.trim(),
        role,
        icon,
        color,
        description: description.trim(),
        preferences,
        sources: template?.defaultSources ?? [],
        output: output as 'message' | 'note' | 'email',
        draftOnly,
        modelKeyId: modelKeyId || undefined,
        maxTokens,
        templateId: template?.id,
      })
      pushToast({ title: `${name.trim()} created`, level: 'info' })
    }
    onSave()
  }

  const selectedKey = keys.find((k) => k.id === modelKeyId)

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.name}` : 'New agent'} width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="space-y-3">
          <Field label="What should we call them?">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Focus Coach" autoFocus />
          </Field>

          <Field label="Role" hint="What they're best at">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none transition focus:border-(--accent)"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="System prompt" hint="Markdown supported — use ## for subtitles, bullets, and bold. This document is sent to the model as instructions.">
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            placeholder={'Keeps sessions short, celebrates every finished block.\n\n## Rules\n- Always summarize with bullets\n- Cheer at the end of every block\n\n## Tone\nEncouraging but direct.'}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Icon" hint="Face for your helper">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AGENT_ICONS) as AgentIconKey[]).map((key) => {
                const Icon = AGENT_ICONS[key]
                const selected = icon === key
                return (
                  <button
                    key={key}
                    onClick={() => setIcon(key)}
                    className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
                      selected
                        ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                        : 'border-(--border) text-(--text-muted) hover:bg-(--surface-2)'
                    }`}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Color" hint="Spot them at a glance">
            <div className="flex flex-wrap gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`grid h-8 w-8 place-items-center rounded-full transition ${
                    color === c ? 'ring-2 ring-(--accent) ring-offset-2 ring-offset-(--surface)' : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c ? <Check size={14} className="text-white" /> : null}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Preferences" hint="Tap to toggle. These shape how they behave.">
          <div className="flex flex-wrap gap-1.5">
            {PREFERENCE_SUGGESTIONS.map((pref) => {
              const active = preferences.includes(pref)
              return (
                <button
                  key={pref}
                  onClick={() => togglePreference(pref)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'bg-(--accent) text-white'
                      : 'bg-(--surface-2) text-(--text-muted) hover:bg-(--border)'
                  }`}
                >
                  {pref}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="border-t border-(--border) pt-4">
          <h3 className="mb-3 text-sm font-semibold">What can they access?</h3>
          <div className="flex flex-col gap-3">
            {CATEGORY_ORDER.map((cat) => {
              const tools = AVAILABLE_TOOLS.filter((t) => t.category === cat)
              if (tools.length === 0) return null
              return (
                <div key={cat}>
                  <p className="mb-2 text-xs font-medium text-(--text-muted)">{CATEGORY_LABELS[cat]}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tools.map((tool) => {
                      const enabled = enabledTools.includes(tool.id)
                      return (
                        <div
                          key={tool.id}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${
                            enabled
                              ? 'border-(--accent) bg-(--accent-soft)/50'
                              : 'border-(--border) bg-(--surface)'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{tool.name}</p>
                            <p className="text-[11px] text-(--text-muted)">{tool.description}</p>
                          </div>
                          {tool.requiresOAuth ? (
                            <Button variant="ghost" size="sm" onClick={() => toggleTool(tool.id)}>
                              {enabled ? 'Connected' : `Connect ${tool.oauthProvider}`}
                            </Button>
                          ) : (
                            <button
                              onClick={() => toggleTool(tool.id)}
                              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                                enabled ? 'bg-(--success)' : 'bg-(--border-strong)'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                  enabled ? 'left-[18px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-(--border) pt-4">
          <h3 className="mb-3 text-sm font-semibold">Model & output</h3>
          <div className="flex flex-col gap-3">
            <Field label="Model key">
              <div className="flex gap-2">
                <select
                  value={modelKeyId}
                  onChange={(e) => setModelKeyId(e.target.value)}
                  className="flex-1 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none transition focus:border-(--accent)"
                >
                  <option value="">No key selected</option>
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>{k.label} ({k.provider})</option>
                  ))}
                </select>
                <Button variant="soft" size="sm" onClick={() => setShowModelKeyModal(true)}>
                  Add key
                </Button>
              </div>
              {selectedKey ? (
                <p className="mt-1 text-xs text-(--text-muted)">
                  {selectedKey.provider} &middot; {selectedKey.defaultModel}
                </p>
              ) : (
                <p className="mt-1 text-xs text-(--text-muted)">
                  No key yet — the chat can still run on the default model.
                </p>
              )}
            </Field>

            <Field label="Deliver results to" hint="Where the agent sends its output">
              <div className="flex gap-2">
                {OUTPUT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOutput(opt)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                      output === opt
                        ? 'bg-(--accent) text-white'
                        : 'bg-(--surface-2) text-(--text-muted) hover:bg-(--border)'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="border-t border-(--border) pt-4">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            <span>Advanced</span>
            <ChevronDown size={16} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          {advancedOpen ? (
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex items-center justify-between rounded-xl bg-(--surface-2) px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Draft mode only</p>
                  <p className="text-[11px] text-(--text-muted)">Agent proposes actions but never executes them</p>
                </div>
                <button
                  onClick={() => setDraftOnly(!draftOnly)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    draftOnly ? 'bg-(--success)' : 'bg-(--border-strong)'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      draftOnly ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              <Field label={`Max tokens: ${maxTokens.toLocaleString()}`}>
                <input
                  type="range"
                  min={500}
                  max={8000}
                  step={100}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full accent-(--accent)"
                />
                <div className="mt-1 flex justify-between text-[11px] text-(--text-muted)">
                  <span>500</span>
                  <span>8,000</span>
                </div>
              </Field>

              <p className="rounded-xl bg-(--surface-2) px-3 py-2 text-xs text-(--text-muted)">
                Budget: 100K tokens/day included. Overage at $0.002 per 1K tokens.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-(--border) pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={handleSave}>
            {initial ? 'Save changes' : 'Create agent'}
          </Button>
        </div>
      </div>

      <ModelKeyModal open={showModelKeyModal} onClose={() => setShowModelKeyModal(false)} />
    </Modal>
  )
}
