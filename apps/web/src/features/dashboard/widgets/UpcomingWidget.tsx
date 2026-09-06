import { format } from 'date-fns'
import { Cake, CalendarDays } from 'lucide-react'
import { useCalendarStore } from '../../../global/stores/useCalendarStore'
import { todayKey } from '../../../global/lib/dates'
import { WidgetCard } from './WidgetCard'

type UpcomingWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

export function UpcomingWidget({ onRemove, compact = false }: UpcomingWidgetProps) {
  const appointments = useCalendarStore((state) => state.appointments)

  const upcoming = appointments
    .filter((appointment) => appointment.date >= todayKey())
    .sort((a, b) => `${a.date}T${a.startTime || '00:00'}`.localeCompare(`${b.date}T${b.startTime || '00:00'}`))
    .slice(0, 4)

  return (
    <WidgetCard title="Calendar" icon={<CalendarDays size={15} />} onRemove={onRemove} compact={compact}>
      {upcoming.length === 0 ? (
        <p className="text-sm text-(--text-muted)">No upcoming appointments.</p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((appointment) => {
            const date = new Date(`${appointment.date}T${appointment.startTime || '00:00'}`)
            const isToday = appointment.date === todayKey()
            const isBirthday = appointment.kind === 'birthday'
            return (
              <li key={appointment.id} className="flex items-center gap-2">
                {isBirthday ? (
                  <Cake size={14} className="shrink-0 text-(--diary)" />
                ) : (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: appointment.color }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{appointment.title}</p>
                  <p className="text-xs text-(--text-muted)">
                    {isToday ? 'Today' : format(date, 'EEE, MMM d')} ·{' '}
                    {isBirthday ? 'Birthday' : appointment.startTime}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}