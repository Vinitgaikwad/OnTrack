import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ListTodo, NotebookPen, Loader2 } from 'lucide-react'
import type { AgentActionItem } from '../../global/repositories/agents.repository'
import { confirmActionItems } from '../../global/repositories/agents.repository'
import { useCalendarStore } from '../../global/stores/useCalendarStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { useToastStore } from '../../global/stores/useToastStore'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'

type RunConfirmModalProps = {
  open: boolean
  agentName: string
  items: AgentActionItem[]
  onCancel: () => void
  onDone: () => void
}

const KIND_META: Record<
  AgentActionItem['kind'],
  { label: string; icon: typeof ListTodo; color: string }
> = {
  task: { label: 'Task', icon: ListTodo, color: '#f59e0b' },
  event: { label: 'Event', icon: CalendarDays, color: '#8b5cf6' },
  note: { label: 'Note', icon: NotebookPen, color: '#0ea5e9' },
}

function metaLine(item: AgentActionItem): string {
  if (item.kind === 'note') return item.note ? item.note : 'Diary note'
  const date = item.date ?? 'No date'
  const time = item.startTime ? (item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime) : '—'
  return `${date} · ${time}`
}

export function RunConfirmModal({ open, agentName, items, onCancel, onDone }: RunConfirmModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i)))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelected(new Set(items.map((_, i) => i)))
  }, [items])

  const allSelected = items.length > 0 && selected.size === items.length

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((_, i) => i)))
  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectedItems = useMemo(
    () => items.filter((_, i) => selected.has(i)),
    [items, selected]
  )

  const confirm = async () => {
    if (selectedItems.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const response = await confirmActionItems(selectedItems)
      useToastStore.getState().push({
        title: `${response.created.length} items added`,
        message: 'Calendar, tasks, and notes now reflect your changes.',
        level: 'info',
      })
      useCalendarStore.setState({ loadStatus: 'idle' })
      void useCalendarStore.getState().ensureLoaded()
      useDiaryStore.setState({ loadStatus: 'idle' })
      void useDiaryStore.getState().ensureLoaded()
      onDone()
    } catch {
      useToastStore.getState().push({
        title: 'Couldn’t add items',
        message: 'Something went wrong while saving. Try again.',
        level: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || items.length === 0) return null

  return (
    <Modal open={open} onClose={onCancel} title="Approve agent additions" width="max-w-md">
      <p className="text-sm text-(--text-muted)">
        <span className="font-medium text-(--text)">{agentName}</span> proposed {items.length}{' '}
        {items.length === 1 ? 'addition' : 'additions'}. Nothing is added until you approve.
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-(--text-muted)">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 accent-(--accent)"
        />
        Select all
      </label>

      <ul className="mt-2 space-y-2">
        {items.map((item, index) => {
          const meta = KIND_META[item.kind]
          const Icon = meta.icon
          const isSelected = selected.has(index)
          return (
            <li key={index}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                  isSelected ? 'border-(--accent) bg-(--accent-soft)/40' : 'border-(--border) bg-(--surface-2)/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(index)}
                  className="h-4 w-4 shrink-0 accent-(--accent)"
                />
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
                    color: meta.color,
                  }}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </span>
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-[11px] text-(--text-muted)">{metaLine(item)}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void confirm()} disabled={selectedItems.length === 0 || submitting}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {submitting
            ? 'Adding…'
            : selectedItems.length === items.length
              ? `Add all (${items.length})`
              : `Add selected (${selectedItems.length})`}
        </Button>
      </div>
    </Modal>
  )
}