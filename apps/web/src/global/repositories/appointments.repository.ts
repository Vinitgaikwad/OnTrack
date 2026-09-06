import { api } from '../lib/api'
import type { Appointment } from '../stores/useCalendarStore'

export type AppointmentDto = Appointment

export async function listAppointments(): Promise<AppointmentDto[]> {
  return api<AppointmentDto[]>('/api/appointments')
}

export async function createAppointment(
  input: Omit<Appointment, 'id'> & { id: string }
): Promise<AppointmentDto> {
  return api<AppointmentDto>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAppointment(
  id: string,
  patch: Partial<Omit<Appointment, 'id'>>
): Promise<AppointmentDto> {
  return api<AppointmentDto>(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteAppointment(id: string): Promise<void> {
  await api<void>(`/api/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}