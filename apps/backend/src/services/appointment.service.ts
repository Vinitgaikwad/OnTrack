import type { Prisma, PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'

type Db = PrismaClient | Prisma.TransactionClient

async function findOwnedAppointment(db: Db, userId: string, appointmentId: string) {
  const appointment = await db.appointment.findFirst({ where: { id: appointmentId, userId } })
  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found.', 404)
  return appointment
}

export async function listAppointments(db: Db, userId: string) {
  return db.appointment.findMany({
    where: { userId },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })
}

export async function createAppointment(
  db: Db,
  userId: string,
  input: {
    id?: string
    kind: 'appointment' | 'birthday' | 'task'
    title: string
    date: string
    startTime: string
    endTime: string | null
    color: string
    notes: string
  }
) {
  return db.appointment.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      userId,
      kind: input.kind,
      title: input.title,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color,
      notes: input.notes ?? '',
    },
  })
}

export async function updateAppointment(
  db: Db,
  userId: string,
  appointmentId: string,
  patch: {
    kind?: 'appointment' | 'birthday' | 'task'
    title?: string
    date?: string
    startTime?: string
    endTime?: string | null
    color?: string
    notes?: string
  }
) {
  await findOwnedAppointment(db, userId, appointmentId)
  return db.appointment.update({ where: { id: appointmentId }, data: patch })
}

export async function deleteAppointment(db: Db, userId: string, appointmentId: string): Promise<void> {
  await findOwnedAppointment(db, userId, appointmentId)
  await db.appointment.delete({ where: { id: appointmentId } })
}