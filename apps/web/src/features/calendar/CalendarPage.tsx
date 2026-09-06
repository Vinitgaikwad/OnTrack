import { useEffect, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarCheck, Cake, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Appointment, CalendarEventKind } from '../../global/stores/useCalendarStore'
import { TASK_EVENT_COLOR, useCalendarStore } from '../../global/stores/useCalendarStore'
import { AppointmentModal } from './AppointmentModal'
import { TaskModal } from './TaskModal'
import { Button } from '../../global/ui/Button'
import { Card } from '../../global/ui/Card'
import { DATE_KEY } from '../../global/lib/dates'

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const appointments = useCalendarStore((state) => state.appointments)
  const ensureLoaded = useCalendarStore((state) => state.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])
  const [entry, setEntry] = useState<{
    date: string
    kind: CalendarEventKind | 'task'
    appointment: Appointment | null
  } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const agendaRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const selectedKey = format(selected, DATE_KEY)
  const dayEntries = appointments
    .filter((appointment) => appointment.date === selectedKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const dayAppointments = dayEntries.filter((appointment) => appointment.kind !== 'task')
  const dayTasks = dayEntries.filter((appointment) => appointment.kind === 'task')

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedKey])

  const goToday = () => {
    const now = new Date()
    setCursor(now)
    setSelected(now)
  }

  const openAdd = (kind: CalendarEventKind | 'task') => {
    setAddOpen(false)
    setEntry({ date: selectedKey, kind, appointment: null })
  }

  const openEdit = (appointment: Appointment) => {
    setAddOpen(false)
    setEntry({ date: appointment.date, kind: appointment.kind, appointment })
  }

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-(--text-muted)">
            Appointments, birthdays, and tasks together, so the day actually makes sense.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" size="sm" onClick={goToday}>
            <CalendarCheck size={14} />
            <span className="hidden sm:inline">Today</span>
            <span className="sm:hidden">Now</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((value) => addMonths(value, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold">
            {format(cursor, 'MMMM yyyy')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((value) => addMonths(value, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden p-2">
          <div className="grid grid-cols-7 gap-1 border-b border-(--border) px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 p-2">
            {days.map((day) => {
              const key = format(day, DATE_KEY)
              const dayAppointments = appointments.filter(
                (appointment) => appointment.date === key && appointment.kind !== 'task'
              )
              const dayTasks = appointments.filter(
                (appointment) => appointment.date === key && appointment.kind === 'task'
              )
              const inMonth = isSameMonth(day, cursor)
              const selectedDay = isSameDay(day, selected)
              return (
                <button
                  key={key}
                  onClick={() => setSelected(day)}
                  className={`flex min-h-12 flex-col items-stretch gap-1 rounded-xl border p-1.5 text-left transition lg:min-h-24 ${
                    selectedDay
                      ? 'border-(--accent) bg-(--accent-soft)'
                      : inMonth
                        ? 'border-transparent hover:bg-(--surface-2)'
                        : 'border-transparent opacity-40 hover:bg-(--surface-2)'
                  }`}
                >
                  <span
                    className={`self-start rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      isToday(day) ? 'bg-(--accent) text-white' : 'text-(--text-muted)'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="hidden flex-col gap-0.5 lg:flex">
                    {dayAppointments.map((appointment) => (
                      <span
                        key={appointment.id}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: appointment.color }}
                      >
                        {appointment.kind === 'birthday'
                          ? `🎂 ${appointment.title}`
                          : `${appointment.startTime} ${appointment.title}`}
                      </span>
                    ))}
                    {dayTasks.map((task) => (
                      <span
                        key={task.id}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: TASK_EVENT_COLOR }}
                      >
                        ✓ {task.title}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 lg:hidden">
                    {dayAppointments.map((appointment) => (
                      <span
                        key={appointment.id}
                        title={appointment.title}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: appointment.color }}
                      />
                    ))}
                    {dayTasks.map((task) => (
                      <span
                        key={task.id}
                        title={`Task: ${task.title}`}
                        className="h-2 w-2 rounded-full bg-(--notes)"
                      />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <div ref={agendaRef} className="scroll-mt-20">
            <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {format(selected, 'EEEE, MMM d')}
                {isToday(selected) ? (
                  <span className="ml-2 rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10px] font-semibold text-(--accent)">
                    Today
                  </span>
                ) : null}
              </h2>
              <div className="relative">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setAddOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={addOpen}
                >
                  <Plus size={14} />
                  Add
                  <ChevronDown size={12} className={`transition ${addOpen ? 'rotate-180' : ''}`} />
                </Button>
                {addOpen ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-(--border) bg-(--surface) p-2 shadow-xl"
                    >
                      <button
                        role="menuitem"
                        onClick={() => openAdd('appointment')}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                      >
                        <CalendarCheck size={16} className="text-(--calendar)" />
                        Appointment
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => openAdd('task')}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                      >
                        <CheckSquare size={16} className="text-(--notes)" />
                        Task
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => openAdd('birthday')}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                      >
                        <Cake size={16} className="text-(--diary)" />
                        Birthday
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {dayEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-(--text-muted)">
                Nothing scheduled. A clear day is a good day.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    onClick={() => openEdit(appointment)}
                    className="flex items-center gap-3 rounded-xl border border-(--border) p-2.5 text-left transition hover:border-(--border-strong)"
                  >
                    <span className="h-full w-1 self-stretch rounded-full" style={{ backgroundColor: appointment.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{appointment.title}</p>
                      <p className="text-[11px] text-(--text-muted)">
                        {appointment.kind === 'birthday' ? (
                          <span className="inline-flex items-center gap-1">
                            <Cake size={11} />
                            All day
                          </span>
                        ) : (
                          <>
                            {appointment.startTime}
                            {appointment.endTime ? ` – ${appointment.endTime}` : ''}
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openEdit(task)}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-(--border-strong) p-2.5 text-left transition hover:border-(--border)"
                  >
                    <span className="h-full w-1 self-stretch rounded-full bg-(--notes)" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-[11px] text-(--text-muted)">Task</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold">The day, at a glance</h2>
            <p className="text-sm leading-relaxed text-(--text-muted)">
              {dayAppointments.length} appointment{dayAppointments.length === 1 ? '' : 's'} and{' '}
              {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'} on this day. Use the Add
              button to plan more.
            </p>
          </Card>
        </div>
      </div>

      {entry?.kind === 'task' ? (
        <TaskModal
          key={entry?.appointment?.id ?? 'new-task'}
          open={entry !== null}
          date={entry.date}
          appointment={entry.appointment}
          onClose={() => setEntry(null)}
        />
      ) : (
        <AppointmentModal
          key={entry?.appointment?.id ?? entry?.kind ?? 'new'}
          open={entry !== null}
          date={entry?.date ?? selectedKey}
          kind={entry?.kind}
          appointment={entry?.appointment ?? null}
          onClose={() => setEntry(null)}
        />
      )}
    </div>
  )
}