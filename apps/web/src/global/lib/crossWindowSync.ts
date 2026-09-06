import { useAgentsStore } from '../stores/useAgentsStore'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { useDiaryStore } from '../stores/useDiaryStore'
import { useNotesStore } from '../stores/useNotesStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useTimerStore } from '../stores/useTimerStore'
import { useUserStore } from '../stores/useUserStore'

type SyncableStore = {
  persist: {
    rehydrate: () => void | Promise<void>
  }
}

const STORES: Array<{ key: string; store: SyncableStore }> = [
  { key: 'ontrack-notes', store: useNotesStore as unknown as SyncableStore },
  { key: 'ontrack-calendar', store: useCalendarStore as unknown as SyncableStore },
  { key: 'ontrack-timer', store: useTimerStore as unknown as SyncableStore },
  { key: 'ontrack-diary', store: useDiaryStore as unknown as SyncableStore },
  { key: 'ontrack-agents', store: useAgentsStore as unknown as SyncableStore },
  { key: 'ontrack-theme', store: useThemeStore as unknown as SyncableStore },
  { key: 'ontrack-dashboard', store: useDashboardStore as unknown as SyncableStore },
  { key: 'ontrack-user', store: useUserStore as unknown as SyncableStore },
]

export function enableCrossWindowSync() {
  window.addEventListener('storage', (event) => {
    const entry = STORES.find(({ key }) => key === event.key)
    if (entry) void entry.store.persist.rehydrate()
  })
}