import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import { toErrorMessage } from '../lib/api'
import { uid } from '../lib/id'
import { DATE_KEY, todayKey } from '../lib/dates'
import {
  createAppointment as createAppointmentRequest,
  deleteAppointment as deleteAppointmentRequest,
  listAppointments,
  updateAppointment as updateAppointmentRequest,
} from '../repositories/appointments.repository'
import { useToastStore } from './useToastStore'

export type CalendarEventKind = 'appointment' | 'birthday' | 'task'
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type Appointment = {
  id: string
  kind: CalendarEventKind
  title: string
  date: string
  startTime: string
  endTime: string | null
  color: string
  notes: string
}

export const EVENT_COLORS = [
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Slate', value: '#64748b' },
]

export const TASK_EVENT_COLOR = '#f59e0b'

type CalendarStore = {
  appointments: Appointment[]
  loadStatus: LoadStatus
  ensureLoaded: () => Promise<void>
  addAppointment: (appointment: Omit<Appointment, 'id'> & { id?: string }) => void
  updateAppointment: (id: string, patch: Partial<Omit<Appointment, 'id'>>) => void
  removeAppointment: (id: string) => void
}

const daysFromNow = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return format(date, DATE_KEY)
}

const seed = (): Appointment[] => [
  {
    id: uid(),
    kind: 'appointment',
    title: 'Morning meds',
    date: todayKey(),
    startTime: '09:00',
    endTime: '09:10',
    color: '#0ea5e9',
    notes: 'Take with breakfast.',
  },
  {
    id: uid(),
    kind: 'appointment',
    title: 'Therapy call',
    date: todayKey(),
    startTime: '15:00',
    endTime: '15:45',
    color: '#8b5cf6',
    notes: '',
  },
  {
    id: uid(),
    kind: 'appointment',
    title: 'Gym',
    date: daysFromNow(1),
    startTime: '09:30',
    endTime: '10:15',
    color: '#10b981',
    notes: 'Leg day.',
  },
]

function pushSyncError(error: unknown): void {
  useToastStore.getState().push({
    title: 'Couldn’t sync calendar',
    message: toErrorMessage(error),
    level: 'error',
  })
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      appointments: seed(),
      loadStatus: 'idle',

      ensureLoaded: async () => {
        if (get().loadStatus === 'loading' || get().loadStatus === 'loaded') return
        set({ loadStatus: 'loading' })
        try {
          const remote = await listAppointments()
          if (remote.length === 0) {
            const local = get().appointments
            if (local.length > 0) {
              const created = await Promise.all(
                local.map((appointment) => createAppointmentRequest(appointment))
              )
              set({ appointments: created, loadStatus: 'loaded' })
            } else {
              set({ appointments: [], loadStatus: 'loaded' })
            }
          } else {
            set({ appointments: remote, loadStatus: 'loaded' })
          }
        } catch (error) {
          set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      addAppointment: (appointment) => {
        const entry: Appointment = { ...appointment, id: appointment.id ?? uid(), kind: appointment.kind }
        set((state) => ({ appointments: [...state.appointments, entry] }))
        void createAppointmentRequest(entry).catch((error) => {
          pushSyncError(error)
          void listAppointments().then((appointments) => set({ appointments }))
        })
      },

      updateAppointment: (id, patch) => {
        set((state) => ({
          appointments: state.appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, ...patch, kind: patch.kind ?? appointment.kind } : appointment
          ),
        }))
        void updateAppointmentRequest(id, patch).catch((error) => {
          pushSyncError(error)
          void listAppointments().then((appointments) => set({ appointments }))
        })
      },

      removeAppointment: (id) => {
        set((state) => ({
          appointments: state.appointments.filter((appointment) => appointment.id !== id),
        }))
        void deleteAppointmentRequest(id).catch((error) => {
          pushSyncError(error)
          void listAppointments().then((appointments) => set({ appointments }))
        })
      },
    }),
    { name: 'ontrack-calendar', partialize: (state) => ({ appointments: state.appointments }) }
  )
)