import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody, validateQuery } from '../lib/validate'
import * as messagesService from '../services/messages.service'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid message id', 400)

const listMessagesQuery = z.object({
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  unread: z.coerce.boolean().optional(),
})

const markReadSchema = z.object({
  read: z.literal(true),
})

export const handleListMessages = (c: Context) =>
  handle(c, async () => {
    const query = validateQuery(c, listMessagesQuery)
    if (!query.ok) return query.response
    const db = prismaClient(c.env.DATABASE_URL)
    const result = await messagesService.listMessages(db, c.get('userId'), query.data)
    return ok(c, result)
  })

export const handleMarkRead = (c: Context) =>
  handle(c, async () => {
    const messageId = idGuard(c.req.param('id'))
    if (!messageId) return badParam(c)
    const body = await validateBody(c, markReadSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const message = await messagesService.markRead(db, c.get('userId'), messageId)
    return ok(c, message)
  })

export const handleDeleteMessage = (c: Context) =>
  handle(c, async () => {
    const messageId = idGuard(c.req.param('id'))
    if (!messageId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    await messagesService.deleteMessage(db, c.get('userId'), messageId)
  })

function idGuard(raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
