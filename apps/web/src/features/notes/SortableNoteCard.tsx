import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Flag, GripVertical, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { NoteTask } from '../../global/stores/useNotesStore'
import { useNotesStore } from '../../global/stores/useNotesStore'
import { IconButton } from '../../global/ui/IconButton'

const PRIORITY_STYLES: Record<NoteTask['priority'], { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 14%, transparent)' },
  medium: { label: 'Mid', color: 'var(--notes)', bg: 'color-mix(in srgb, var(--notes) 14%, transparent)' },
  low: { label: 'Low', color: 'var(--calendar)', bg: 'color-mix(in srgb, var(--calendar) 14%, transparent)' },
}

type NoteCardVisualProps = {
  task: NoteTask
  overlay?: boolean
}

export function NoteCardVisual({ task, overlay = false }: NoteCardVisualProps) {
  const toggleDone = useNotesStore((state) => state.toggleDone)
  const removeTask = useNotesStore((state) => state.removeTask)
  const priority = PRIORITY_STYLES[task.priority]

  return (
    <div
      className={`rounded-2xl border p-3 ${
        overlay
          ? 'cursor-grabbing rotate-2 border-(--accent)/40 bg-(--surface-2) shadow-xl ring-2 ring-(--accent)/20'
          : 'group cursor-grab border-(--border) bg-(--surface-2) shadow-sm transition hover:border-(--border-strong)'
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVerticalDot />
        <button
          onClick={() => toggleDone(task.id)}
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-(--border-strong) transition hover:border-(--accent)"
          aria-label={task.doneAt ? 'Mark as not done' : 'Mark as done'}
        >
          {task.doneAt ? <DoneCheck /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium leading-snug ${
              task.doneAt ? 'text-(--text-muted) line-through' : ''
            }`}
          >
            {task.title}
          </p>
          {task.text ? <p className="mt-0.5 text-xs leading-relaxed text-(--text-muted)">{task.text}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: priority.color, backgroundColor: priority.bg }}
            >
              <Flag size={10} />
              {priority.label}
            </span>
            {task.dueDate ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-(--text-muted)"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <Calendar size={10} />
                {format(new Date(task.dueDate + 'T12:00:00'), 'MMM d')}
              </span>
            ) : null}
          </div>
        </div>
        <div className={`transition ${overlay ? 'opacity-0' : 'group-hover:opacity-100 opacity-0'}`}>
          <IconButton icon={Trash2} label="Delete note" onClick={() => removeTask(task.id)} className="h-7 w-7" />
        </div>
      </div>
    </div>
  )
}

export function SortableNoteCard({ task }: { task: NoteTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  // The visual lives in the DragOverlay while dragging. Keep this copy in-flow and
  // only slide horizontally, so sibling cards part smoothly instead of the card
  // itself lagging after the cursor.
  const slideTransform = { x: transform?.x ?? 0, y: 0, scaleX: 1, scaleY: 1 }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(slideTransform),
        transition: isDragging ? 'opacity 0.2s ease' : transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 40 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <NoteCardVisual task={task} />
    </div>
  )
}

function GripVerticalDot() {
  return (
    <span className="mt-0.5 shrink-0 text-(--text-muted)">
      <GripVertical size={13} />
    </span>
  )
}

function DoneCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-(--success)" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}