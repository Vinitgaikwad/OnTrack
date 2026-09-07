import { api } from '../lib/api'
import type { Mood } from '../stores/useDiaryStore'

export type DiaryDto = {
  id: string
  date: string
  title: string
  content: string
  mood: Mood
  tags: string[]
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export type DiaryInput = {
  id: string
  date: string
  title: string
  content: string
  mood: Mood
  tags: string[]
  hidden: boolean
  createdAt: number
}

export type DiaryPatch = Partial<
  Pick<DiaryInput, 'date' | 'title' | 'content' | 'mood' | 'tags' | 'hidden'>
>

export async function loadDiary(
  month: string | null,
  offset: number,
  limit: number
): Promise<{ entries: DiaryDto[]; hasMore: boolean }> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (month) params.set('month', month)
  return api<{ entries: DiaryDto[]; hasMore: boolean }>(`/api/diary?${params.toString()}`)
}

export async function createDiary(input: DiaryInput): Promise<DiaryDto> {
  return api<DiaryDto>('/api/diary', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateDiary(id: string, patch: DiaryPatch): Promise<DiaryDto> {
  return api<DiaryDto>(`/api/diary/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteDiary(id: string): Promise<void> {
  return api<void>(`/api/diary/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' })
}

export async function unlockDiary(id: string, password: string): Promise<DiaryDto> {
  return api<DiaryDto>('/api/diary/unlock', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  })
}