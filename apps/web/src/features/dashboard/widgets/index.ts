import type { ComponentType } from 'react'
import { BookOpen, Bot, CalendarDays, Home, StickyNote, Timer } from 'lucide-react'
import type { WidgetId } from '../../../global/stores/useDashboardStore'
import { AgentsWidget } from './AgentsWidget'
import { DiaryWidget } from './DiaryWidget'
import { NotesWidget } from './NotesWidget'
import { TimerWidget } from './TimerWidget'
import { TodayWidget } from './TodayWidget'
import { UpcomingWidget } from './UpcomingWidget'

export type WidgetDef = {
  id: WidgetId
  label: string
  description: string
  route: string
  icon: ComponentType<{ size?: number | string }>
  component: ComponentType<{ onRemove?: () => void; compact?: boolean }>
}

export const WIDGET_DEFS: WidgetDef[] = [
  {
    id: 'today',
    label: 'Today',
    description: 'Your day at a glance',
    route: '/',
    icon: Home,
    component: TodayWidget,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Tasks and quick capture',
    route: '/notes',
    icon: StickyNote,
    component: NotesWidget,
  },
  {
    id: 'agents',
    label: 'Agents',
    description: 'Who is on duty',
    route: '/agents',
    icon: Bot,
    component: AgentsWidget,
  },
  {
    id: 'diary',
    label: 'Diary',
    description: 'Latest entry and mood',
    route: '/diary',
    icon: BookOpen,
    component: DiaryWidget,
  },
  {
    id: 'timer',
    label: 'Timer',
    description: 'Focus session countdown',
    route: '/timer',
    icon: Timer,
    component: TimerWidget,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Next appointments',
    route: '/calendar',
    icon: CalendarDays,
    component: UpcomingWidget,
  },
]