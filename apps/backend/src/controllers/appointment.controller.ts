import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody } from '../lib/validate'
import * as appointmentsService from '../services/appointment.service'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid appointment id', 400)

const timePattern = /^(\d{2}:\d{2})?$/

const appointmentSchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(['appointment', 'birthday', 'task']),
  title: z.string().trim().min(1, 'Title is required').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  startTime: z
    .string()
    .regex(timePattern, 'Use HH:mm or empty')
    .optional()
    .default(''),
  endTime: z
    .union([z.string().regex(timePattern, 'Use HH:mm'), z.null()])
    .optional()
    .default(null),
  color: z.string().trim().min(1).max(50).default('#8b5cf6'),
  notes: z.string().max(20_000).optional().default(''),
})

// Plain .optional() fields (no .default()) — zod applies .default() even through
// .partial(), which would re-inject e.g. color:'#8b5cf6' and clobber values on a PATCH.
const updateAppointmentSchema = z
  .object({
    kind: z.enum(['appointment', 'birthday', 'task']).optional(),
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
    startTime: z
      .string()
      .regex(timePattern, 'Use HH:mm or empty')
      .optional(),
    endTime: z
      .union([z.string().regex(timePattern, 'Use HH:mm'), z.null()])
      .optional(),
    color: z.string().trim().min(1).max(50).optional(),
    notes: z.string().max(20_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const handleListAppointments = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const appointments = await appointmentsService.listAppointments(db, c.get('userId'))
    return ok(c, appointments)
  })

export const handleCreateAppointment = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, appointmentSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const appointment = await appointmentsService.createAppointment(db, c.get('userId'), body.data)
    return ok(c, appointment, 201)
  })

export const handleUpdateAppointment = (c: Context) =>
  handle(c, async () => {
    const appointmentId = idGuard(c, c.req.param('id'))
    if (!appointmentId) return badParam(c)
    const body = await validateBody(c, updateAppointmentSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const appointment = await appointmentsService.updateAppointment(
      db,
      c.get('userId'),
      appointmentId,
      body.data
    )
    return ok(c, appointment)
  })

export const handleDeleteAppointment = (c: Context) =>
  handle(c, async () => {
    const appointmentId = idGuard(c, c.req.param('id'))
    if (!appointmentId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    await appointmentsService.deleteAppointment(db, c.get('userId'), appointmentId)
  })

function idGuard(_c: Context, raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}