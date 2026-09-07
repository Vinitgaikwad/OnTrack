import { format } from 'date-fns'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, Sparkles, Timer } from 'lucide-react'
import { useCalendarStore } from '../../global/stores/useCalendarStore'
import { useTimerStore } from '../../global/stores/useTimerStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import { Card } from '../../global/ui/Card'
import { todayKey } from '../../global/lib/dates'
import { MOOD_META } from '../diary/DiaryPage'

export function TodayPage() {
  const appointments = useCalendarStore((state) => state.appointments)
  const ensureLoaded = useCalendarStore((state) => state.ensureLoaded)
  const timer = useTimerStore()
  const entries = useDiaryStore((state) => state.entries)
  const ensureDiaryLoaded = useDiaryStore((state) => state.ensureLoaded)
  const agents = useAgentsStore((state) => state.agents)

  useEffect(() => {
    void ensureLoaded()
    void ensureDiaryLoaded()
  }, [ensureLoaded, ensureDiaryLoaded])

  const today = todayKey()
  const todayEntries = appointments
    .filter((appointment) => appointment.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const todayTasks = todayEntries.filter((appointment) => appointment.kind === 'task')

  const plan = `${todayEntries.length} thing${todayEntries.length === 1 ? '' : 's'} planned for today`
  const latestEntry = entries[0]
  const enabledAgents = agents.filter((agent) => agent.enabled)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-sm font-medium text-(--accent)">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-(--text-muted)">{plan}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={15} className="text-(--calendar)" />
              Today&apos;s schedule
            </h2>
            <Link to="/calendar" className="text-xs font-medium text-(--accent) transition hover:underline">
              Calendar <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {todayEntries.length === 0 ? (
            <p className="py-4 text-sm text-(--text-muted)">Nothing scheduled. A clear day is a good day.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {todayEntries.map((appointment) =>
                appointment.kind === 'task' ? (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-(--border-strong) px-3 py-2.5"
                  >
                    <span className="h-8 w-1 shrink-0 rounded-full bg-(--notes)" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{appointment.title}</p>
                      <p className="text-[11px] text-(--text-muted)">Task</p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-xl border border-(--border) px-3 py-2.5"
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: appointment.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{appointment.title}</p>
                      <p className="text-[11px] text-(--text-muted)">
                        {appointment.kind === 'birthday'
                          ? 'All day'
                          : `${appointment.startTime}${appointment.endTime ? ` – ${appointment.endTime}` : ''}`}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Timer size={15} className="text-(--timer)" />
              Focus
            </h2>
            <Link to="/timer" className="text-xs font-medium text-(--accent) transition hover:underline">
              Timer <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {timer.status === 'running'
              ? 'In flow'
              : timer.status === 'paused'
                ? 'Paused'
                : `${timer.minutes} min`}
          </p>
          <p className="text-xs text-(--text-muted)">
            {timer.status === 'running'
              ? `Focus session running · ${timer.reminders.length} reminder${timer.reminders.length === 1 ? '' : 's'} waiting`
              : timer.status === 'paused'
                ? 'Session on hold — pick it back up anytime.'
                : 'Ready when you are.'}
          </p>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={15} className="text-(--diary)" />
              Diary
            </h2>
            <Link to="/diary" className="text-xs font-medium text-(--accent) transition hover:underline">
              Write <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {latestEntry ? (
            latestEntry.hidden ? (
              <p className="py-4 text-sm text-(--text-muted)">A hidden entry is waiting. Open the diary to unlock it.</p>
            ) : (
              <>
                <p className="text-lg">{MOOD_META[latestEntry.mood].emoji}</p>
                <p className="mt-1 line-clamp-2 text-sm text-(--text-muted)">{latestEntry.content}</p>
              </>
            )
          ) : (
            <p className="py-4 text-sm text-(--text-muted)">
              No entry yet. One honest sentence can change the day.
            </p>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={15} className="text-(--agents)" />
              Agents
            </h2>
            <Link to="/agents" className="text-xs font-medium text-(--accent) transition hover:underline">
              Manage <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {enabledAgents.length === 0 ? (
            <p className="py-4 text-sm text-(--text-muted)">No agents on duty. Create one.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {enabledAgents.slice(0, 3).map((agent) => (
                <div key={agent.id} className="flex items-center gap-2.5 rounded-xl bg-(--surface-2) px-3 py-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="ml-auto text-[11px] text-(--text-muted)">{agent.role}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 size={15} className="text-(--success)" />
              Quick win
            </h2>
            <Link to="/calendar" className="text-xs font-medium text-(--accent) transition hover:underline">
              Calendar <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-(--text-muted)">
            {todayEntries.length === 0
              ? 'Nothing scheduled — plan one tiny thing to keep the streak alive.'
              : todayTasks.length > 0
                ? `Easiest start: "${todayTasks[0].title}".`
                : `First up: ${todayEntries[0].title} at ${todayEntries[0].startTime}.`}
          </p>
        </Card>
      </div>
    </div>
  )
}