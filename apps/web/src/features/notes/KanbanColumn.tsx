import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { NoteTask, TaskStatus } from '../../global/stores/useNotesStore'
import { NotesColumnHeader } from './NotesColumnHeader'
import { SortableNoteCard } from './SortableNoteCard'
import { Button } from '../../global/ui/Button'

type KanbanColumnProps = {
  id: TaskStatus
  title: string
  accent: string
  hint: string
  tasks: NoteTask[]
  isDragSource: boolean
  onAddClick: () => void
}

export function KanbanColumn({ id, title, accent, hint, tasks, isDragSource, onAddClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-64 flex-1 flex-col rounded-2xl border bg-(--surface) p-3 transition md:min-w-0 ${
        isOver ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-(--border)'
      } ${isDragSource ? 'opacity-90' : ''}`}
    >
      <NotesColumnHeader title={title} accent={accent} hint={hint} count={tasks.length} />

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex flex-col gap-2.5 py-2 ${tasks.length === 0 ? 'min-h-32' : ''}`}>
          {tasks.length === 0 ? (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-(--border-strong) text-xs text-(--text-muted)">
              Drop a note here
            </div>
          ) : (
            tasks.map((task) => <SortableNoteCard key={task.id} task={task} />)
          )}
        </div>
      </SortableContext>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-(--text-muted)"
        onClick={onAddClick}
      >
        <Plus size={15} />
        Add note
      </Button>
    </div>
  )
}