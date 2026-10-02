import { create } from 'zustand'
import { isAuthError, toErrorMessage } from '../lib/api'
import { uid } from '../lib/id'
import {
  createDiary,
  deleteDiary as deleteDiaryRequest,
  loadDiary,
  unlockDiary,
  updateDiary as updateDiaryRequest,
  type DiaryDto,
} from '../repositories/diary.repository'
import { useToastStore } from './useToastStore'

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'rough'
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type DiaryEntry = {
  id: string
  date: string
  title: string
  content: string
  mood: Mood
  tags: string[]
  hidden: boolean
  createdAt: number
  updatedAt: number
}

export const DIARY_PAGE_SIZE = 5

const toDiaryEntry = (dto: DiaryDto): DiaryEntry => ({
  id: dto.id,
  date: dto.date,
  title: dto.title,
  content: dto.content,
  mood: dto.mood,
  tags: dto.tags,
  hidden: dto.hidden,
  createdAt: new Date(dto.createdAt).getTime(),
  updatedAt: new Date(dto.updatedAt).getTime(),
})

const sortEntries = (entries: DiaryEntry[]): DiaryEntry[] =>
  [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  )

const mergeEntries = (
  entries: DiaryEntry[],
  incoming: DiaryEntry[]
): DiaryEntry[] => {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  for (const entry of incoming) byId.set(entry.id, entry)
  return sortEntries([...byId.values()])
}

const matchesMonth = (entry: DiaryEntry, month: string | null): boolean =>
  month ? entry.date.startsWith(month) : true

function pushSyncError(error: unknown): void {
  if (isAuthError(error)) return
  useToastStore.getState().push({
    title: 'Couldn’t sync diary',
    message: toErrorMessage(error),
    level: 'error',
  })
}

type DiaryStore = {
  entries: DiaryEntry[]
  hasMore: boolean
  loadStatus: LoadStatus
  activeMonth: string | null
  /** Bumped on month switches and local mutations; stale responses never overwrite newer state. */
  epoch: number
  ensureLoaded: () => Promise<void>
  /** Force-reloads the active month. Use after a server-side mutation (e.g. an agent run). */
  refresh: () => Promise<void>
  ensureMonth: (month: string) => Promise<void>
  loadMore: () => Promise<void>
  setActiveMonth: (month: string | null) => void
  addEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateEntry: (
    id: string,
    patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>>
  ) => void
  removeEntry: (id: string) => void
  /** Verifies the account password, permanently unhides the entry (DB + store), returns nothing on success. */
  reveal: (id: string, password: string) => Promise<void>
}

/** Legacy key written by the old `persist`-wrapped store. */
const LEGACY_PERSIST_KEY = 'ontrack-diary'

/**
 * Deletes the legacy `ontrack-diary` localStorage key.
 *
 * Dropping the `persist` wrapper stops the store *reading* the key, but the
 * cached entries — another account's private writing, in plaintext — would sit
 * on disk indefinitely. Call once at startup. No-op when the key is absent.
 */
export function purgeLegacyDiaryCache(): void {
  try {
    localStorage.removeItem(LEGACY_PERSIST_KEY)
  } catch (error) {
    // Private-mode / storage-disabled browsers throw on access. Nothing to purge
    // there, and a diary read failure must not block app boot.
    console.warn('Could not purge legacy diary cache', error)
  }
}

/**
 * Diary store. Server-backed only — the DB is the single source of truth.
 *
 * Deliberately NOT wrapped in zustand `persist`: diary entries are private per
 * account, and a `localStorage` copy is shared by every account that signs in on
 * the same machine. User B would see User A's entries on their first paint.
 * `apps/web/src/global/lib/crossWindowSync.ts` therefore skips this store too —
 * there is nothing to rehydrate across windows.
 */
export const useDiaryStore = create<DiaryStore>()((set, get) => {
  async function refreshCurrentMonth(): Promise<void> {
    const expected = get().epoch + 1
    set({ loadStatus: 'loading', epoch: expected })
    try {
      const month = get().activeMonth
      const page = await loadDiary(month, 0, DIARY_PAGE_SIZE)
      if (get().epoch !== expected) return
      set((state) => ({
        entries: mergeEntries(state.entries, page.entries.map(toDiaryEntry)),
        hasMore: page.hasMore,
        loadStatus: 'loaded',
      }))
    } catch (error) {
      if (get().epoch === expected) set({ loadStatus: 'error' })
      pushSyncError(error)
    }
  }

  return {
    entries: [],
    hasMore: false,
    loadStatus: 'idle',
    activeMonth: null,
    epoch: 0,

    refresh: async () => {
      await refreshCurrentMonth()
    },

    ensureLoaded: async () => {
      if (get().loadStatus === 'loading' || get().loadStatus === 'loaded')
        return
      set({ loadStatus: 'loading' })
      try {
        const epoch = get().epoch
        // Only the newest row is needed to seed `entries[0]`, which feeds the
        // Today page and the dashboard widget. The full month arrives via
        // ensureMonth().
        const first = await loadDiary(null, 0, 1)
        if (get().epoch !== epoch) return
        set((state) => ({
          entries: mergeEntries(state.entries, first.entries.map(toDiaryEntry)),
          loadStatus: 'loaded',
        }))
      } catch (error) {
        set({ loadStatus: 'error' })
        pushSyncError(error)
      }
    },

    ensureMonth: async (month) => {
      if (
        get().activeMonth === month &&
        get().loadStatus === 'loaded' &&
        get().entries.some((entry) => matchesMonth(entry, month))
      ) {
        return
      }
      set({ activeMonth: month, loadStatus: 'loading', epoch: get().epoch + 1 })
      const expected = get().epoch
      try {
        const page = await loadDiary(month, 0, DIARY_PAGE_SIZE)
        if (get().epoch !== expected) return
        set((state) => ({
          entries: mergeEntries(state.entries, page.entries.map(toDiaryEntry)),
          hasMore: page.hasMore,
          loadStatus: 'loaded',
        }))
      } catch (error) {
        if (get().epoch === expected) set({ loadStatus: 'error' })
        pushSyncError(error)
      }
    },

    loadMore: async () => {
      if (get().loadStatus !== 'loaded' || !get().hasMore) return
      set({ loadStatus: 'loading', epoch: get().epoch + 1 })
      const expected = get().epoch
      try {
        const month = get().activeMonth
        const offset = get().entries.filter((entry) =>
          matchesMonth(entry, month)
        ).length
        const page = await loadDiary(month, offset, DIARY_PAGE_SIZE)
        if (get().epoch !== expected) return
        set((state) => ({
          entries: mergeEntries(state.entries, page.entries.map(toDiaryEntry)),
          hasMore: page.hasMore,
          loadStatus: 'loaded',
        }))
      } catch (error) {
        if (get().epoch === expected) set({ loadStatus: 'error' })
        pushSyncError(error)
      }
    },

    setActiveMonth: (month) => set({ activeMonth: month }),

    addEntry: (input) => {
      const entry: DiaryEntry = {
        ...input,
        id: uid(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((state) => ({
        entries: sortEntries([entry, ...state.entries]),
        epoch: state.epoch + 1,
      }))
      void createDiary({
        id: entry.id,
        date: entry.date,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        hidden: entry.hidden,
        createdAt: entry.createdAt,
      })
        .then((dto) => {
          set((state) => ({
            entries: mergeEntries(state.entries, [toDiaryEntry(dto)]),
          }))
        })
        .catch((error) => {
          pushSyncError(error)
          void refreshCurrentMonth()
        })
    },

    updateEntry: (id, patch) => {
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === id
            ? { ...entry, ...patch, updatedAt: Date.now() }
            : entry
        ),
        epoch: state.epoch + 1,
      }))
      void updateDiaryRequest(id, patch)
        .then((dto) => {
          set((state) => ({
            entries: mergeEntries(state.entries, [toDiaryEntry(dto)]),
          }))
        })
        .catch((error) => {
          pushSyncError(error)
          void refreshCurrentMonth()
        })
    },

    removeEntry: (id) => {
      set((state) => ({
        entries: state.entries.filter((entry) => entry.id !== id),
        epoch: state.epoch + 1,
      }))
      void deleteDiaryRequest(id).catch((error) => {
        pushSyncError(error)
        void refreshCurrentMonth()
      })
    },

    reveal: async (id, password) => {
      const entry = await unlockDiary(id, password)
      set((state) => ({
        entries: mergeEntries(state.entries, [toDiaryEntry(entry)]),
      }))
    },
  }
})
