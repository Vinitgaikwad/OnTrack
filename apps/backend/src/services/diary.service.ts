import { compare } from 'bcryptjs'
import type { Prisma, PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'

type Db = PrismaClient | Prisma.TransactionClient

export type DiaryMood = 'great' | 'good' | 'okay' | 'low' | 'rough'

export type DiaryDto = {
  id: string
  date: string
  title: string
  content: string
  mood: DiaryMood
  tags: string[]
  hidden: boolean
  createdAt: Date
  updatedAt: Date
}

async function findOwnedEntry(db: Db, userId: string, entryId: string) {
  const entry = await db.diaryEntry.findFirst({ where: { id: entryId, userId } })
  if (!entry) throw new AppError('NOT_FOUND', 'Diary entry not found.', 404)
  return entry
}

async function verifyAccountPassword(
  db: Db,
  userId: string,
  password: string | undefined
): Promise<boolean> {
  if (!password) return false
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  if (!user?.passwordHash) return false
  return compare(password, user.passwordHash)
}

/** Hidden entries may only be mutated with a verified account password. */
async function assertHiddenAccess(
  db: Db,
  userId: string,
  entry: { hidden: boolean },
  password: string | undefined
): Promise<void> {
  if (!entry.hidden) return
  if (!password) throw new AppError('HIDDEN_ENTRY', 'Enter your password to modify this entry.', 403)
  const valid = await verifyAccountPassword(db, userId, password)
  if (!valid) throw new AppError('INVALID_PASSWORD', 'Incorrect password.', 403)
}

/** Always strips content for hidden entries except in the unlock response. */
function toDto(entry: {
  id: string
  date: string
  title: string
  content: string
  mood: DiaryMood
  tags: string[]
  hidden: boolean
  createdAt: Date
  updatedAt: Date
}): DiaryDto {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title,
    content: entry.hidden ? '' : entry.content,
    mood: entry.mood,
    tags: entry.tags,
    hidden: entry.hidden,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

export async function listDiary(
  db: Db,
  userId: string,
  input: { month?: string; offset: number; limit: number }
): Promise<{ entries: DiaryDto[]; hasMore: boolean }> {
  const rows = await db.diaryEntry.findMany({
    where: { userId, ...(input.month ? { date: { startsWith: input.month } } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    skip: input.offset,
    take: input.limit + 1,
  })
  const hasMore = rows.length > input.limit
  const page = rows.slice(0, input.limit)
  return { entries: page.map(toDto), hasMore }
}

export async function createDiary(
  db: Db,
  userId: string,
  input: {
    id?: string
    title: string
    content: string
    mood: DiaryMood
    tags: string[]
    date: string
    hidden: boolean
    createdAt?: number
  }
): Promise<DiaryDto> {
  const entry = await db.diaryEntry.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      userId,
      title: input.title,
      content: input.content,
      mood: input.mood,
      tags: input.tags,
      date: input.date,
      hidden: input.hidden,
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
    },
  })
  return toDto(entry)
}

export async function unlockDiary(
  db: Db,
  userId: string,
  entryId: string,
  password: string
): Promise<DiaryDto> {
  const entry = await findOwnedEntry(db, userId, entryId)
  if (!entry.hidden) return toDto(entry)
  const valid = await verifyAccountPassword(db, userId, password)
  if (!valid) throw new AppError('INVALID_PASSWORD', 'Incorrect password.', 403)
  const updated = await db.diaryEntry.update({ where: { id: entryId }, data: { hidden: false } })
  return toDto(updated)
}

export async function updateDiary(
  db: Db,
  userId: string,
  entryId: string,
  patch: Partial<{
    title: string
    content: string
    mood: DiaryMood
    tags: string[]
    date: string
    hidden: boolean
  }>,
  password: string | undefined
): Promise<DiaryDto> {
  const entry = await findOwnedEntry(db, userId, entryId)
  await assertHiddenAccess(db, userId, entry, password)
  const updated = await db.diaryEntry.update({ where: { id: entryId }, data: patch })
  return toDto(updated)
}

export async function deleteDiary(
  db: Db,
  userId: string,
  entryId: string,
  password: string | undefined
): Promise<void> {
  const entry = await findOwnedEntry(db, userId, entryId)
  await assertHiddenAccess(db, userId, entry, password)
  await db.diaryEntry.delete({ where: { id: entryId } })
}