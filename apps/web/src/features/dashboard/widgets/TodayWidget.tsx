import { format } from 'date-fns'
import { useEffect } from 'react'
import { Home } from 'lucide-react'
import { useCalendarStore } from '../../../global/stores/useCalendarStore'
import { todayKey } from '../../../global/lib/dates'
import { WidgetCard } from './WidgetCard'

type TodayWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

export function TodayWidget({ onRemove, compact = false }: TodayWidgetProps) {
  const appointments = useCalendarStore((state) => state.appointments)
  const ensureLoaded = useCalendarStore((state) => state.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const today = todayKey()
  const todayEntries = appointments
    .filter((appointment) => appointment.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <WidgetCard
      title="Today"
      icon={<Home size={15} />}
      onRemove={onRemove}
      compact={compact}
      right={
        <span className="text-[11px] font-medium text-(--accent)">
          {format(new Date(), 'EEE, MMM d')}
        </span>
      }
    >
      <p className={`mt-0.5 text-xs text-(--text-muted)`}>
        {todayEntries.length} thing{todayEntries.length === 1 ? '' : 's'} on the calendar today
      </p>

      {todayEntries.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {todayEntries.slice(0, compact ? 5 : 6).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  entry.kind === 'task' ? 'bg-(--notes)' : ''
                }`}
                style={entry.kind === 'task' ? undefined : { backgroundColor: entry.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
              <span className="shrink-0 text-[11px] text-(--text-muted)">
                {entry.kind === 'birthday' ? 'All day' : entry.kind === 'task' ? 'Task' : entry.startTime}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {todayEntries.length === 0 ? (
        <p className="mt-1 text-sm text-(--text-muted)">A clear day. Enjoy it.</p>
      ) : null}
    </WidgetCard>
  )
}