import { api } from '../lib/api'
import type { TaskPriority, TaskStatus } from '../stores/useNotesStore'

export type TaskDto = {
  id: string
  title: string
  text: string
  priority: TaskPriority
  status: TaskStatus
  position: number
  dueDate: string | null
  createdAt: string
  doneAt: string | null
}

export async function listTasks(): Promise<TaskDto[]> {
  return api<TaskDto[]>('/api/tasks')
}

export async function createTask(input: {
  id: string
  title: string
  text: string
  priority: TaskPriority
  dueDate: string | null
  createdAt: number
}): Promise<TaskDto> {
  return api<TaskDto>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTask(
  id: string,
  patch: { title?: string; text?: string; priority?: TaskPriority; dueDate?: string | null }
): Promise<TaskDto> {
  return api<TaskDto>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function moveTask(id: string, to: TaskStatus, toIndex?: number): Promise<TaskDto> {
  return api<TaskDto>(`/api/tasks/${encodeURIComponent(id)}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ to, ...(toIndex !== undefined ? { toIndex } : {}) }),
  })
}

export async function deleteTask(id: string): Promise<void> {
  await api<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}