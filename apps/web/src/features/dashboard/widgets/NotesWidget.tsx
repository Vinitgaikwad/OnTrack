import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Plus, StickyNote, Trash2 } from 'lucide-react'
import type { NoteTask } from '../../../global/stores/useNotesStore'
import { useNotesStore } from '../../../global/stores/useNotesStore'
import { Button } from '../../../global/ui/Button'
import { WidgetCard } from './WidgetCard'

type NotesWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

const rowMotion = {
  layout: true,
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 48, height: 0, marginTop: 0, marginBottom: 0 },
  transition: { duration: 0.22, ease: 'easeOut' },
} as const

const PRIORITY_DOT: Record<NoteTask['priority'], string> = {
  high: '#EF4444',
  medium: '#F97316',
  low: '#3B82F6',
}

export function NotesWidget({ onRemove, compact = false }: NotesWidgetProps) {
  const todo = useNotesStore((state) => state.board.todo)
  const doing = useNotesStore((state) => state.board.doing)
  const addTask = useNotesStore((state) => state.addTask)
  const moveTask = useNotesStore((state) => state.moveTask)
  const commitRowMove = useNotesStore((state) => state.commitRowMove)
  const toggleDone = useNotesStore((state) => state.toggleDone)
  const removeTask = useNotesStore((state) => state.removeTask)
  const ensureLoaded = useNotesStore((state) => state.ensureLoaded)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    addTask({ title, text: '', priority: 'medium', dueDate: null })
    setDraft('')
  }

  const renderRow = (task: NoteTask, kind: 'todo' | 'doing') => {
    const complete = kind === 'doing'
    return (
      <motion.li key={task.id} {...rowMotion}>
        <div
          className={`group flex items-center gap-2 rounded-md px-1 py-0.5 transition hover:bg-(--surface-2) ${
            complete ? 'bg-(--accent-soft)/40' : ''
          }`}
        >
          <span
            title={`${task.priority} priority`}
            aria-label={`${task.priority} priority`}
            className="h-3 w-3 shrink-0 rounded-full border-2 border-(--surface) shadow-sm"
            style={{ backgroundColor: PRIORITY_DOT[task.priority] }}
          />
          <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
          <span className="hidden transition group-hover:block">
            <button
              onClick={() => removeTask(task.id)}
              aria-label="Delete task"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-(--text-muted) transition hover:text-(--danger)"
            >
              <Trash2 size={12} />
            </button>
          </span>
          {complete ? (
            <button
              onClick={() => toggleDone(task.id)}
              aria-label="Complete task"
              title="Done — it slides away"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-(--border-strong) text-(--text-muted) transition hover:border-(--success) hover:bg-(--success)/10 hover:text-(--success)"
            >
              <Check size={12} />
            </button>
          ) : (
            <button
              onClick={() => {
                moveTask(task.id, 'todo', 'doing')
                commitRowMove(task.id, 'doing')
              }}
              aria-label="Start doing"
              title="Move to doing"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-(--text-muted) transition hover:bg-(--accent-soft) hover:text-(--accent)"
            >
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </motion.li>
    )
  }

  return (
    <WidgetCard title="Notes" icon={<StickyNote size={15} />} onRemove={onRemove} compact={compact}>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="Add a task…"
          className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-sm outline-none transition focus:border-(--accent)"
        />
        <Button size="sm" variant="soft" onClick={submit} aria-label="Add task">
          <Plus size={14} />
        </Button>
      </div>

      {todo.length > 0 || doing.length > 0 ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {todo.length > 0 ? (
            <section>
              <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">
                To Do
              </p>
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>{todo.map((task) => renderRow(task, 'todo'))}</AnimatePresence>
              </ul>
            </section>
          ) : null}

          {doing.length > 0 ? (
            <section>
              <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">
                Doing
              </p>
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>{doing.map((task) => renderRow(task, 'doing'))}</AnimatePresence>
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 px-1 text-sm text-(--text-muted)">
          Nothing on the list. Add something above.
        </p>
      )}
    </WidgetCard>
  )
}