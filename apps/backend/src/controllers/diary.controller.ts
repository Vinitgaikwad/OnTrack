import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody, validateQuery } from '../lib/validate'
import * as diaryService from '../services/diary.service'
import type { DiaryMood } from '../services/diary.service'

const idSchema = z.string().min(1).max(100)

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const moodSchema = z.enum(['great', 'good', 'okay', 'low', 'rough'])
const passwordSchema = z.string().min(1).max(128)

const diaryFields = {
  title: z.string().max(200).default(''),
  content: z.string().max(50_000),
  mood: moodSchema.default('okay' as DiaryMood),
  tags: z.array(z.string().max(50)).max(20).default([]),
  date: dateSchema,
  hidden: z.boolean().default(false),
}

const createDiarySchema = z
  .object({
    ...diaryFields,
    id: idSchema.optional(),
    createdAt: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (value) => value.title.trim().length > 0 || value.content.trim().length > 0,
    'Title or content is required'
  )

// Plain .optional() fields (no .default()) — zod applies .default() even through
// .partial(), which would re-inject e.g. hidden:false and clobber values on a PATCH.
const updateDiarySchema = z
  .object({
    title: z.string().max(200).optional(),
    content: z.string().max(50_000).optional(),
    mood: moodSchema.optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    date: dateSchema.optional(),
    hidden: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

const unlockDiarySchema = z.object({
  id: idSchema,
  password: passwordSchema,
})

const deleteDiarySchema = z.object({
  password: passwordSchema.optional(),
})

const listQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM').optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(5),
})

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid diary entry id', 400)

export const handleListDiary = (c: Context) =>
  handle(c, async () => {
    const query = validateQuery(c, listQuerySchema)
    if (!query.ok) return query.response
    const db = prismaClient(c.env.DATABASE_URL)
    const result = await diaryService.listDiary(db, c.get('userId'), query.data)
    return ok(c, result)
  })

export const handleCreateDiary = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, createDiarySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const entry = await diaryService.createDiary(db, c.get('userId'), body.data)
    return ok(c, entry, 201)
  })

export const handleUnlockDiary = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, unlockDiarySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const entry = await diaryService.unlockDiary(
      db,
      c.get('userId'),
      body.data.id,
      body.data.password
    )
    return ok(c, entry)
  })

export const handleUpdateDiary = (c: Context) =>
  handle(c, async () => {
    const entryId = idGuard(c, c.req.param('id'))
    if (!entryId) return badParam(c)
    const body = await validateBody(c, updateDiarySchema)
    if (!body.ok) return body.response
    const { password, ...patch } = body.data
    const db = prismaClient(c.env.DATABASE_URL)
    const entry = await diaryService.updateDiary(db, c.get('userId'), entryId, patch, password)
    return ok(c, entry)
  })

export const handleDeleteDiary = (c: Context) =>
  handle(c, async () => {
    const entryId = idGuard(c, c.req.param('id'))
    if (!entryId) return badParam(c)
    const body = await validateBody(c, deleteDiarySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    await diaryService.deleteDiary(db, c.get('userId'), entryId, body.data.password)
  })

function idGuard(_c: Context, raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}