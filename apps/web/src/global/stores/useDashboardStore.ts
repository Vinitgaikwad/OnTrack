import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetId = 'today' | 'notes' | 'agents' | 'diary' | 'timer' | 'calendar'

export const DEFAULT_WIDGETS: WidgetId[] = [
  'today',
  'notes',
  'agents',
  'diary',
  'timer',
  'calendar',
]

type DashboardState = {
  widgets: WidgetId[]
  hideWidget: (id: WidgetId) => void
  showWidget: (id: WidgetId) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      hideWidget: (id) =>
        set((state) => ({ widgets: state.widgets.filter((widget) => widget !== id) })),
      showWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.includes(id) ? state.widgets : [...state.widgets, id],
        })),
    }),
    { name: 'ontrack-dashboard' }
  )
)