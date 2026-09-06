import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'

export const DEFAULT_PRESETS = [10, 15, 25, 45]

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished'

export type ReminderLevel = 1 | 2 | 3

export type Reminder = {
  id: string
  kind: 'focus' | 'break'
  message: string
  level: ReminderLevel
  createdAt: number
  lastEscalatedAt: number
}

type TimerState = {
  presets: number[]
  minutes: number
  status: SessionStatus
  endAt: number | null
  remainingMs: number
  reminders: Reminder[]
  soundOn: boolean
  notificationsOn: boolean
}

type TimerActions = {
  setMinutes: (minutes: number) => void
  addPreset: (minutes: number) => void
  updatePreset: (from: number, to: number) => void
  removePreset: (minutes: number) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  finish: () => void
  createReminder: (level: ReminderLevel, kind: 'focus' | 'break', message: string) => void
  escalateReminder: (id: string) => void
  dismissReminder: (id: string) => void
  setSoundOn: (on: boolean) => void
  setNotificationsOn: (on: boolean) => void
}

export type TimerStore = TimerState & TimerActions

const TOTAL_MS = (minutes: number) => minutes * 60 * 1000

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      presets: DEFAULT_PRESETS,
      minutes: 25,
      status: 'idle',
      endAt: null,
      remainingMs: TOTAL_MS(25),
      reminders: [],
      soundOn: true,
      notificationsOn: false,

      setMinutes: (minutes) => {
        const safe = Math.max(1, Math.min(180, Math.round(minutes) || 1))
        set({ minutes: safe, remainingMs: TOTAL_MS(safe), status: 'idle', endAt: null })
      },
      addPreset: (minutes) => {
        const safe = Math.max(1, Math.min(180, Math.round(minutes) || 1))
        const presets = get().presets.includes(safe) ? get().presets : [...get().presets, safe]
        set({ presets: [...presets].sort((a, b) => a - b) })
      },
      updatePreset: (from, to) => {
        const safe = Math.max(1, Math.min(180, Math.round(to) || 1))
        const next = get().presets.filter((m) => m !== from)
        const presets = next.includes(safe) ? next : [...next, safe]
        set({
          presets: [...presets].sort((a, b) => a - b),
          ...(get().minutes === from && get().status === 'idle'
            ? { minutes: safe, remainingMs: TOTAL_MS(safe), endAt: null }
            : {}),
        })
      },
      removePreset: (minutes) => set({ presets: get().presets.filter((m) => m !== minutes) }),

      start: () => {
        const { minutes, status } = get()
        const fromNow = status === 'paused' ? get().remainingMs : TOTAL_MS(minutes)
        set({ status: 'running', endAt: Date.now() + fromNow })
      },
      pause: () => {
        const { status, endAt } = get()
        if (status !== 'running' || !endAt) return
        set({ status: 'paused', endAt: null, remainingMs: Math.max(0, endAt - Date.now()) })
      },
      resume: () => {
        const { status, remainingMs } = get()
        if (status !== 'paused') return
        set({ status: 'running', endAt: Date.now() + remainingMs })
      },
      reset: () =>
        set({ status: 'idle', endAt: null, remainingMs: TOTAL_MS(get().minutes) }),

      finish: () => {
        set({ status: 'finished', endAt: null, remainingMs: 0 })
        const { soundOn, notificationsOn, createReminder } = get()
        createReminder(1, 'focus', 'Focus session complete. Step away for a minute.')
        if (soundOn) playChime(1)
        if (notificationsOn) notifyBrowser('Focus complete', 'Step away for a minute.')
      },

      createReminder: (level, kind, message) => {
        const reminder: Reminder = {
          id: uid(),
          kind,
          message,
          level,
          createdAt: Date.now(),
          lastEscalatedAt: Date.now(),
        }
        set({ reminders: [...get().reminders, reminder] })
      },
      escalateReminder: (id) => {
        set({
          reminders: get().reminders.map((reminder) =>
            reminder.id === id && reminder.level < 3
              ? { ...reminder, level: (reminder.level + 1) as ReminderLevel, lastEscalatedAt: Date.now() }
              : reminder
          ),
        })
      },
      dismissReminder: (id) =>
        set({ reminders: get().reminders.filter((reminder) => reminder.id !== id) }),

      setSoundOn: (on) => set({ soundOn: on }),
      setNotificationsOn: (on) => set({ notificationsOn: on }),
    }),
    { name: 'ontrack-timer' }
  )
)

export function playChime(repeats = 1) {
  try {
    const AudioCtx = window.AudioContext
    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.gain.value = 0.18
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    for (let i = 0; i < repeats; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 740
      osc.connect(gain)
      osc.start(now + i * 0.45)
      osc.stop(now + i * 0.45 + 0.35)
    }
    window.setTimeout(() => ctx.close(), repeats * 500 + 200)
  } catch {
    // audio unavailable — reminders still show in the UI
  }
}

export function notifyBrowser(title: string, body: string) {
  if (!('Notification' in window)) return
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    // notifications blocked — in-app reminders still work
  }
}