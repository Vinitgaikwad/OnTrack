import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { NoteTask, TaskColumn, TaskStatus } from '../../global/stores/useNotesStore'
import { useNotesStore } from '../../global/stores/useNotesStore'
import { KanbanColumn } from './KanbanColumn'
import { NoteModal } from './NoteModal'
import { DragGhost } from './DragGhost'

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

  // While dragging, the board is frozen: the pinned in-flow card and the portaled
  // ghost are the only visual actors, so nothing reorders mid-air and the collision
  // target stays stable. Target by pointer position, cards taking precedence over
  // their column — that decides where the note lands on release.
  const collisionDetection: CollisionDetection = (args) => {
    const underPointer = pointerWithin(args).filter((collision) => collision.id !== args.active.id)
    const card = underPointer.find((collision) => !(String(collision.id) in useNotesStore.getState().board))
    if (card) return [card]
    if (underPointer.length > 0) return underPointer
    const byCorners = closestCorners(args).filter((collision) => collision.id !== args.active.id)
    return byCorners.length > 0 ? byCorners : closestCorners(args)
  }

  const activeTask = activeId
    ? Object.values(board)
        .flat()
        .find((task) => task.id === activeId) ?? null
    : null

  const findColumn = (source: TaskColumn, id: string): TaskStatus | null => {
    if (id in source) return id as TaskStatus
    for (const [key, tasks] of Object.entries(source)) {
      if (tasks.some((task) => task.id === id)) return key as TaskStatus
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const id = String(active.id)
    setActiveId(null)

    const current = useNotesStore.getState().board
    const fromColumn = findColumn(current, id)
    if (!fromColumn) return
    const fromIndex = current[fromColumn].findIndex((task) => task.id === id)
    if (fromIndex === -1) return

    // No over (or dropped on itself) means "stay put" — just re-sync.
    if (!over || String(over.id) === id) {
      commitRowMove(id, fromColumn, fromIndex)
      return
    }

    const overId = String(over.id)
    const overIsTask = !(overId in current)
    const toColumn = overIsTask ? findColumn(current, overId) : (overId as TaskStatus)
    if (!toColumn) return
    const overIndex =
      overIsTask && toColumn !== null ? current[toColumn].findIndex((task) => task.id === overId) : -1
    const toIndex = overIndex >= 0 ? overIndex : current[toColumn].length

    // moveTask inserts at toIndex into the column *without* the active task, which
    // matches arrayMove semantics both within a column and across columns.
    moveTask(id, fromColumn, toColumn, toIndex)
    commitRowMove(id, toColumn, toIndex)
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
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
      </DndContext>

      {activeTask ? <DragGhost key={activeTask.id} task={activeTask} /> : null}

      <NoteModal
        key={modal?.task?.id ?? modal?.column ?? 'new'}
        open={modal !== null}
        onClose={() => setModal(null)}
        task={modal?.task ?? null}
      />
    </div>
  )
}