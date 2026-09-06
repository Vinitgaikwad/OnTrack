import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { NoteTask, TaskStatus } from '../../global/stores/useNotesStore'
import { useNotesStore } from '../../global/stores/useNotesStore'
import { KanbanColumn } from './KanbanColumn'
import { NoteModal } from './NoteModal'
import { NoteCardVisual } from './SortableNoteCard'

const COLUMNS: { id: TaskStatus; title: string; accent: string; hint: string }[] = [
  { id: 'todo', title: 'To Do', accent: 'var(--notes)', hint: 'Catch it before it escapes' },
  { id: 'doing', title: 'Doing', accent: 'var(--timer)', hint: 'Right now, this one' },
  { id: 'done', title: 'Done', accent: 'var(--success)', hint: 'Earned a tiny celebration' },
]

export function NotesPage() {
  const board = useNotesStore((state) => state.board)
  const loadStatus = useNotesStore((state) => state.loadStatus)
  const ensureLoaded = useNotesStore((state) => state.ensureLoaded)
  const moveTask = useNotesStore((state) => state.moveTask)
  const commitRowMove = useNotesStore((state) => state.commitRowMove)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ column: TaskStatus; task: NoteTask | null } | null>(null)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const activeTask = activeId
    ? Object.values(board)
        .flat()
        .find((task) => task.id === activeId) ?? null
    : null

  const allTaskIds = useMemo(
    () => Object.values(board).flat().map((task) => task.id),
    [board]
  )

  const findColumn = (id: string): TaskStatus | null => {
    if (id in board) return id as TaskStatus
    for (const [key, tasks] of Object.entries(board)) {
      if (tasks.some((task) => task.id === id)) return key as TaskStatus
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeColumn = findColumn(String(active.id))
    const overColumn = findColumn(String(over.id))
    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    const overIsTask = !(String(over.id) in board)
    const overTask = overIsTask ? board[overColumn].find((t) => t.id === String(over.id)) : null
    const overIndex = overTask ? board[overColumn].indexOf(overTask) : board[overColumn].length
    moveTask(String(active.id), activeColumn, overColumn, overIndex)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    const current = useNotesStore.getState().board
    const columnId = findColumn(String(active.id))
    if (!columnId) return
    const tasks = current[columnId]
    const fromIndex = tasks.findIndex((task) => task.id === String(active.id))
    if (fromIndex === -1) return

    let toIndex = fromIndex

    if (over && String(over.id) !== String(active.id) && !(String(over.id) in board)) {
      const overIndex = tasks.findIndex((task) => task.id === String(over.id))
      if (overIndex !== -1) {
        const reordered = arrayMove(tasks, fromIndex, overIndex)
        useNotesStore.setState({ board: { ...current, [columnId]: reordered } })
        toIndex = overIndex
      }
    }

    commitRowMove(String(active.id), columnId, toIndex)
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
        <p className="text-sm text-(--text-muted)">
          To Do → Doing → Done. Drag the cards, they move like sticky notes should.
        </p>
        {loadStatus === 'error' ? (
          <p className="mt-2 text-sm text-(--danger)">Couldn’t reach the server — showing local changes.</p>
        ) : null}
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-2 scroll-thin md:auto-rows-fr md:grid md:grid-cols-3 md:overflow-visible">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                accent={column.accent}
                hint={column.hint}
                tasks={board[column.id]}
                isDragSource={activeTask !== null}
                onAddClick={() => setModal({ column: column.id, task: null })}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay
          dropAnimation={{
            duration: 260,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeTask ? <NoteCardVisual task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <NoteModal
        key={modal?.task?.id ?? modal?.column ?? 'new'}
        open={modal !== null}
        onClose={() => setModal(null)}
        task={modal?.task ?? null}
      />
    </div>
  )
}