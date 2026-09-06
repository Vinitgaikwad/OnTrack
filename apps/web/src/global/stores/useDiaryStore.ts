import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'rough'

export type DiaryEntry = {
  id: string
  date: string
  title: string
  content: string
  mood: Mood
  tags: string[]
  createdAt: number
  updatedAt: number
}

type DiaryStore = {
  entries: DiaryEntry[]
  addEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateEntry: (id: string, patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>) => void
  removeEntry: (id: string) => void
}

export const useDiaryStore = create<DiaryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            { ...entry, id: uid(), createdAt: Date.now(), updatedAt: Date.now() },
            ...state.entries,
          ],
        })),
      updateEntry: (id, patch) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, ...patch, updatedAt: Date.now() } : entry
          ),
        })),
      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
    }),
    { name: 'ontrack-diary' }
  )
)