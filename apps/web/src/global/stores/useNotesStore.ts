import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isAuthError, toErrorMessage } from '../lib/api'
import { uid } from '../lib/id'
import {
  createTask,
  deleteTask,
  listTasks,
  moveTask as moveTaskRequest,
  updateTask as updateTaskRequest,
  type TaskDto,
} from '../repositories/tasks.repository'
import { useToastStore } from './useToastStore'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type NoteTask = {
  id: string
  title: string
  text: string
  priority: TaskPriority
  dueDate: string | null
  createdAt: number
  doneAt: number | null
}

export type TaskColumn = Record<TaskStatus, NoteTask[]>

export type NotesStore = {
  board: TaskColumn
  loadStatus: LoadStatus
  ensureLoaded: () => Promise<void>
  addTask: (task: { title: string; text: string; priority: TaskPriority; dueDate: string | null }) => void
  updateTask: (id: string, patch: Partial<Pick<NoteTask, 'title' | 'text' | 'priority' | 'dueDate'>>) => void
  removeTask: (id: string) => void
  /** Local-only preview move (used mid-drag). Persist separately via commitRowMove on drop. */
  moveTask: (id: string, from: TaskStatus, to: TaskStatus, toIndex?: number) => void
  toggleDone: (id: string) => void
  /** Persists a board move — call exactly once per dropped change. */
  commitRowMove: (id: string, to: TaskStatus, toIndex?: number) => void
}

type NotesState = NotesStore & {
  /** Bumped on every local mutation; stale fetchBoard results never overwrite newer state. */
  epoch: number
}

const emptyBoard = (): TaskColumn => ({ todo: [], doing: [], done: [] })

const mapColumns = (board: TaskColumn, fn: (column: NoteTask[]) => NoteTask[]): TaskColumn =>
  Object.fromEntries(Object.entries(board).map(([key, column]) => [key, fn(column)])) as TaskColumn

const toNoteTask = (dto: TaskDto): NoteTask => ({
  id: dto.id,
  title: dto.title,
  text: dto.text,
  priority: dto.priority,
  dueDate: dto.dueDate,
  createdAt: new Date(dto.createdAt).getTime(),
  doneAt: dto.doneAt ? new Date(dto.doneAt).getTime() : null,
})

function applyMove(
  board: TaskColumn,
  id: string,
  from: TaskStatus,
  to: TaskStatus,
  toIndex = -1
): TaskColumn | null {
  const source = board[from]
  const task = source.find((item) => item.id === id)
  if (!task) return null
  const without = source.filter((item) => item.id !== id)
  const target = from === to ? without : [...board[to]]
  const insertAt = toIndex >= 0 ? Math.min(toIndex, target.length) : target.length
  target.splice(insertAt, 0, { ...task, doneAt: to === 'done' ? Date.now() : null })
  return { ...board, [from]: without, [to]: target }
}

async function fetchBoard(): Promise<TaskColumn> {
  const dtos = await listTasks()
  const board = emptyBoard()
  for (const dto of dtos) board[dto.status].push(toNoteTask(dto))
  return board
}

function pushSyncError(error: unknown): void {
  if (isAuthError(error)) return
  useToastStore.getState().push({
    title: 'Couldn’t sync tasks',
    message: toErrorMessage(error),
    level: 'error',
  })
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      board: emptyBoard(),
      loadStatus: 'idle',
      epoch: 0,

      ensureLoaded: async () => {
        if (get().loadStatus === 'loading' || get().loadStatus === 'loaded') return
        set({ loadStatus: 'loading' })
        try {
          const epoch = get().epoch
          const board = await fetchBoard()
          if (get().epoch === epoch) set({ board, loadStatus: 'loaded' })
        } catch (error) {
          set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      addTask: (task) => {
        const note: NoteTask = { id: uid(), ...task, createdAt: Date.now(), doneAt: null }
        set((state) => ({
          board: { ...state.board, todo: [...state.board.todo, note] },
          epoch: state.epoch + 1,
        }))
        void createTask({
          id: note.id,
          title: note.title,
          text: note.text,
          priority: note.priority,
          dueDate: note.dueDate,
          createdAt: note.createdAt,
        }).catch((error) => {
          pushSyncError(error)
          void fetchBoard().then((board) => set({ board }))
        })
      },

      updateTask: (id, patch) => {
        set((state) => ({
          board: mapColumns(state.board, (column) =>
            column.map((task) => (task.id === id ? { ...task, ...patch } : task))
          ),
          epoch: state.epoch + 1,
        }))
        void updateTaskRequest(id, {
          title: patch.title,
          text: patch.text,
          priority: patch.priority,
          dueDate: patch.dueDate,
        }).catch((error) => {
          pushSyncError(error)
          void fetchBoard().then((board) => set({ board }))
        })
      },

      removeTask: (id) => {
        set((state) => ({
          board: mapColumns(state.board, (column) => column.filter((task) => task.id !== id)),
          epoch: state.epoch + 1,
        }))
        void deleteTask(id).catch((error) => {
          pushSyncError(error)
          void fetchBoard().then((board) => set({ board }))
        })
      },

      moveTask: (id, from, to, toIndex = -1) => {
        set((state) => {
          const board = applyMove(state.board, id, from, to, toIndex)
          return board ? { board, epoch: state.epoch + 1 } : state
        })
      },

      toggleDone: (id) => {
        const board = get().board
        for (const status of ['todo', 'doing', 'done'] as const) {
          if (board[status].some((item) => item.id === id)) {
            const to: TaskStatus = status === 'done' ? 'todo' : 'done'
            set((state) => {
              const next = applyMove(state.board, id, status, to)
              return next ? { board: next, epoch: state.epoch + 1 } : state
            })
            void moveTaskRequest(id, to).catch((error) => {
              pushSyncError(error)
              void fetchBoard().then((board) => set({ board }))
            })
            return
          }
        }
      },

      commitRowMove: (id, to, toIndex) => {
        void moveTaskRequest(id, to, toIndex).catch((error) => {
          pushSyncError(error)
          void fetchBoard().then((board) => set({ board }))
        })
      },
    }),
    {
      name: 'ontrack-notes',
      partialize: (state) => ({ board: state.board }),
    }
  )
)