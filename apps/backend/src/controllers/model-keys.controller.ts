import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody } from '../lib/validate'
import * as modelKeysService from '../services/model-keys.service'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid model key id', 400)

const createModelKeySchema = z.object({
  provider: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1),
  baseUrl: z.string().url().optional(),
})

export const handleListModelKeys = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const keys = await modelKeysService.listModelKeys(db, c.get('userId'))
    return ok(c, keys)
  })

export const handleCreateModelKey = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, createModelKeySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const key = await modelKeysService.createModelKey(db, c.get('userId'), body.data, c.env.MODEL_KEY_ENCRYPTION_KEY)
    return ok(c, key, 201)
  })

export const handleDeleteModelKey = (c: Context) =>
  handle(c, async () => {
    const keyId = idGuard(c.req.param('id'))
    if (!keyId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    await modelKeysService.deleteModelKey(db, c.get('userId'), keyId)
  })

function idGuard(raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
