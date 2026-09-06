import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import {
  useTimerStore,
  playChime,
  notifyBrowser,
} from '../../global/stores/useTimerStore'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Input } from '../../global/ui/Field'
import { useToastStore } from '../../global/stores/useToastStore'

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TimerPage() {
  const timer = useTimerStore()
  const [now, setNow] = useState(Date.now())
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [customInput, setCustomInput] = useState('')
  const pushToast = useToastStore((state) => state.push)

  useEffect(() => {
    if (!presetsOpen) return
    setEdits(Object.fromEntries(timer.presets.map((minutes) => [String(minutes), String(minutes)])))
    setCustomInput('')
  }, [presetsOpen])

  const remainingMs = timer.status === 'running' && timer.endAt ? Math.max(0, timer.endAt - now) : timer.remainingMs
  const progress = 1 - remainingMs / (timer.minutes * 60_000)

  useEffect(() => {
    if (timer.status !== 'running' || !timer.endAt) return
    const id = window.setInterval(() => {
      const delta = timer.endAt ? timer.endAt - Date.now() : 1
      setNow(Date.now())
      if (delta <= 0) timer.finish()
    }, 250)
    return () => window.clearInterval(id)
  }, [timer.status, timer.endAt])

  const recentTimerId = useRef<number | null>(null)
  useEffect(() => {
    if (timer.status === 'running') {
      recentTimerId.current = window.setTimeout(() => {
        playChime(1)
      }, Math.max(0, timer.minutes * 60_000 - 5_000))
      return () => {
        if (recentTimerId.current) window.clearTimeout(recentTimerId.current)
      }
    }
  }, [timer.status, timer.minutes])

  useEffect(() => {
    if (!timer.soundOn) return
    const checkInterval = window.setInterval(() => {
      const pending = timer.reminders
      for (const reminder of pending) {
        const age = Date.now() - reminder.lastEscalatedAt
        if (reminder.level === 1 && age > 30_000) {
          timer.escalateReminder(reminder.id)
          playChime(2)
        } else if (reminder.level === 2 && age > 60_000) {
          timer.escalateReminder(reminder.id)
          playChime(3)
          notifyBrowser('Still there?', 'Your focus session is waiting for you.')
        }
      }
    }, 5_000)
    return () => window.clearInterval(checkInterval)
  }, [timer.soundOn, timer.reminders])

  const parseMinutes = (value: string): number | null => {
    const minutes = Math.round(Number(value))
    return Number.isFinite(minutes) && minutes >= 1 && minutes <= 180 ? minutes : null
  }

  const addCustomPreset = () => {
    const minutes = parseMinutes(customInput)
    if (minutes === null) {
      pushToast({ title: 'Pick 1–180 minutes', level: 'warn' })
      return
    }
    if (timer.presets.includes(minutes)) {
      pushToast({ title: `${minutes} min already exists`, level: 'warn' })
      return
    }
    timer.addPreset(minutes)
    setEdits((current) => ({ ...current, [String(minutes)]: String(minutes) }))
    setCustomInput('')
    pushToast({ title: `Added ${minutes} min preset`, level: 'info' })
  }

  const updatePresetRow = (original: number, value: string) => {
    const minutes = parseMinutes(value)
    if (minutes === null) {
      pushToast({ title: 'Pick 1–180 minutes', level: 'warn' })
      return
    }
    if (minutes === original) return
    if (timer.presets.some((preset) => preset === minutes)) {
      pushToast({ title: `${minutes} min already exists`, level: 'warn' })
      return
    }
    timer.updatePreset(original, minutes)
    setEdits((current) => ({ ...current, [String(original)]: String(minutes) }))
    pushToast({ title: `Updated preset to ${minutes} min`, level: 'info' })
  }

  const deletePresetRow = (minutes: number) => {
    timer.removePreset(minutes)
    setEdits((current) => {
      const next = { ...current }
      delete next[String(minutes)]
      return next
    })
    if (timer.minutes === minutes && timer.status === 'idle') {
      const next = timer.presets.filter((preset) => preset !== minutes)[0] ?? 25
      timer.setMinutes(next)
    }
    pushToast({ title: `Removed ${minutes} min preset`, level: 'info' })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Timer</h1>
        <p className="text-sm text-(--text-muted)">
          Pomodoro, but it bends to you. Pick a length and go.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-(--border) bg-(--surface) p-4 sm:p-8">
          <div className="flex flex-wrap justify-center gap-2">
            {timer.presets.map((minutes) => (
              <button
                key={minutes}
                onClick={() => {
                  timer.setMinutes(minutes)
                  timer.reset()
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  timer.minutes === minutes
                    ? 'bg-(--timer) text-white shadow-sm'
                    : 'bg-(--surface-2) text-(--text-muted) hover:bg-(--border)'
                }`}
              >
                {minutes} min
              </button>
            ))}
            <button
              onClick={() => setPresetsOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-(--surface-2) text-(--text-muted) transition hover:bg-(--border)"
              aria-label="Manage presets"
              title="Add, edit, or remove presets"
            >
              <Pencil size={14} />
            </button>
          </div>

          <div className="relative grid h-64 w-64 place-items-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="9" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--timer)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(1, Math.max(0, progress)))}
                className="transition-[stroke-dashoffset] duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums tracking-tight">
                {formatMs(remainingMs)}
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-widest text-(--text-muted)">
                {timer.status === 'running' ? 'Focusing' : timer.status === 'paused' ? 'Paused' : timer.status === 'finished' ? 'Done' : 'Ready'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timer.status === 'running' ? (
              <Button variant="soft" onClick={timer.pause}>
                <Pause size={16} />
                Pause
              </Button>
            ) : timer.status === 'paused' ? (
              <Button onClick={timer.resume}>
                <Play size={16} />
                Resume
              </Button>
            ) : (
              <Button onClick={timer.start}>
                <Play size={16} />
                Start session
              </Button>
            )}
            <Button variant="ghost" onClick={timer.reset}>
              <RotateCcw size={15} />
              Reset
            </Button>
          </div>

          <div className="flex items-center gap-5 text-xs text-(--text-muted)">
            <button
              onClick={() => timer.setSoundOn(!timer.soundOn)}
              className="flex items-center gap-1.5 transition hover:text-(--text)"
            >
              {timer.soundOn ? <Bell size={14} /> : <BellOff size={14} />}
              {timer.soundOn ? 'Sound on' : 'Sound off'}
            </button>
            <button
              onClick={() => {
                if (timer.notificationsOn) {
                  timer.setNotificationsOn(false)
                } else if ('Notification' in window) {
                  Notification.requestPermission().then((permission) => {
                    timer.setNotificationsOn(permission === 'granted')
                  })
                } else {
                  timer.setNotificationsOn(true)
                }
              }}
              className="flex items-center gap-1.5 transition hover:text-(--text)"
            >
              <Zap size={14} />
              {timer.notificationsOn ? 'Alerts on' : 'Alerts off'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-(--border) bg-(--surface) p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bell size={15} className="text-(--timer)" />
              Reminders
            </h2>
            {timer.reminders.length === 0 ? (
              <p className="text-sm text-(--text-muted)">
                Nothing pending. Finish a focus session and a reminder will wait here — gently
                escalating until you take a break.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {timer.reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                      reminder.level === 3 ? 'border-(--danger)/40 bg-(--danger)/10' : 'border-(--border)'
                    }`}
                  >
                    <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${reminder.level === 3 ? 'text-(--danger)' : 'text-(--timer)'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{reminder.message}</p>
                      <p className="mt-0.5 text-[11px] text-(--text-muted)">Level {reminder.level} · repeats until you acknowledge</p>
                    </div>
                    <button
                      onClick={() => {
                        timer.dismissReminder(reminder.id)
                        pushToast({ title: 'Reminder acknowledged', level: 'info' })
                      }}
                      className="grid h-7 w-7 place-items-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
                      aria-label="Acknowledge"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-(--border) bg-(--surface) p-5">
            <h2 className="mb-2 text-sm font-semibold">Why flexible?</h2>
            <p className="text-sm leading-relaxed text-(--text-muted)">
              25 minutes doesn&apos;t fit every brain every day. Set 10 for the rough mornings, 45 when
              you&apos;re in flow. The timer keeps track — you pick the shape.
            </p>
          </div>
        </div>
      </div>

      <Modal open={presetsOpen} onClose={() => setPresetsOpen(false)} title="Timer presets">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {timer.presets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-(--border-strong) px-3 py-4 text-center text-sm text-(--text-muted)">
                No presets yet. Add one below.
              </p>
            ) : (
              timer.presets.map((minutes) => (
                <div key={minutes} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={edits[String(minutes)] ?? String(minutes)}
                    onChange={(event) =>
                      setEdits({ ...edits, [String(minutes)]: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') updatePresetRow(minutes, edits[String(minutes)] ?? String(minutes))
                    }}
                    aria-label={`Edit ${minutes} min preset`}
                  />
                  <Button
                    variant="soft"
                    size="sm"
                    disabled={
                      parseMinutes(edits[String(minutes)] ?? '') === null ||
                      Number(edits[String(minutes)]) === minutes
                    }
                    onClick={() => updatePresetRow(minutes, edits[String(minutes)] ?? String(minutes))}
                    aria-label={`Save ${minutes} min preset`}
                  >
                    <Check size={14} />
                    Save
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deletePresetRow(minutes)}
                    aria-label={`Delete ${minutes} min preset`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-(--border) pt-3">
            <span className="mb-1.5 block text-xs font-medium text-(--text-muted)">Add another</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={180}
                value={customInput}
                onChange={(event) => setCustomInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addCustomPreset()
                }}
                placeholder="30"
                aria-label="Add another"
              />
              <Button
                disabled={parseMinutes(customInput) === null}
                onClick={addCustomPreset}
                aria-label="Add preset"
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
            <span className="mt-1 block text-xs text-(--text-muted)">Between 1 and 180.</span>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setPresetsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}