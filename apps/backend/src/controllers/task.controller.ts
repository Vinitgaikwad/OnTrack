import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody, validateQuery } from '../lib/validate'
import * as tasksService from '../services/task.service'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid task id', 400)

const createTaskSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  text: z.string().max(20_000).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'daily']).optional().default('medium'),
  dueDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), z.null()])
    .optional()
    .default(null),
  createdAt: z.number().int().positive().optional().nullable(),
})

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  text: z.string().max(20_000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'daily']).optional(),
  dueDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), z.null()])
    .optional(),
})

const moveTaskSchema = z.object({
  to: z.enum(['todo', 'doing', 'done']),
  toIndex: z.number().int().min(0).optional(),
})

const listQuerySchema = z.object({
  status: z.enum(['todo', 'doing', 'done']).optional(),
})

export const handleListTasks = (c: Context) =>
  handle(c, async () => {
    const query = validateQuery(c, listQuerySchema)
    if (!query.ok) return query.response
    const db = prismaClient(c.env.DATABASE_URL)
    const tasks = await tasksService.listTasks(db, c.get('userId'), query.data.status)
    return ok(c, tasks)
  })

export const handleCreateTask = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, createTaskSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const task = await tasksService.createTask(db, c.get('userId'), body.data)
    return ok(c, task, 201)
  })

export const handleUpdateTask = (c: Context) =>
  handle(c, async () => {
    const taskId = idGuard(c, c.req.param('id'))
    if (!taskId) return badParam(c)
    const body = await validateBody(c, updateTaskSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const task = await tasksService.updateTask(db, c.get('userId'), taskId, body.data)
    return ok(c, task)
  })

export const handleMoveTask = (c: Context) =>
  handle(c, async () => {
    const taskId = idGuard(c, c.req.param('id'))
    if (!taskId) return badParam(c)
    const body = await validateBody(c, moveTaskSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const task = await tasksService.moveTask(db, c.get('userId'), taskId, body.data)
    return ok(c, task)
  })

export const handleDeleteTask = (c: Context) =>
  handle(c, async () => {
    const taskId = idGuard(c, c.req.param('id'))
    if (!taskId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    await tasksService.deleteTask(db, c.get('userId'), taskId)
  })

function idGuard(_c: Context, raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}