import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Agent } from '../../global/stores/useAgentsStore'
import { AGENT_COLORS, AGENT_ICONS, type AgentIconKey } from './AgentsPage'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input, Textarea } from '../../global/ui/Field'
import { useToastStore } from '../../global/stores/useToastStore'

type AgentEditorProps = {
  open: boolean
  initial: Agent | null
  onClose: () => void
  onSave: (data: Omit<Agent, 'id'>) => void
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

export function AgentEditor({ open, initial, onClose, onSave }: AgentEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'Coach')
  const [icon, setIcon] = useState<AgentIconKey>((initial?.icon as AgentIconKey) ?? 'brain')
  const [color, setColor] = useState(initial?.color ?? AGENT_COLORS[0])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [preferences, setPreferences] = useState<string[]>(initial?.preferences ?? [])
  const pushToast = useToastStore((state) => state.push)

  const togglePreference = (pref: string) => {
    setPreferences((current) =>
      current.includes(pref) ? current.filter((p) => p !== pref) : [...current, pref]
    )
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      role,
      icon,
      color,
      description: description.trim(),
      preferences,
      enabled: initial?.enabled ?? true,
    })
    pushToast({ title: `${name.trim()} is ready`, level: 'info' })
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.name}` : 'New agent'}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_1.2fr] gap-3">
          <Field label="Name" hint="What should we call them?">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Focus Coach" />
          </Field>
          <Field label="Job">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none transition focus:border-(--accent)"
            >
              {['Coach', 'Reminder', 'Tracker', 'Listener', 'Nagger'].map((job) => (
                <option key={job} value={job}>
                  {job}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Icon" hint="Pick a face for your helper.">
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

        <Field label="Color">
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

        <Field label="Description" hint="What are they here for?">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Keeps sessions short, celebrates every finished block."
          />
        </Field>

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

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={handleSave}>
            {initial ? 'Save changes' : 'Create agent'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}