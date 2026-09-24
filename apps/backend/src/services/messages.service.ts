import type { Prisma, PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'
import { seedExampleMessages } from './seed.service'

type Db = PrismaClient | Prisma.TransactionClient

async function findOwnedMessage(db: Db, userId: string, messageId: string) {
  const message = await db.agentMessage.findFirst({ where: { id: messageId, userId } })
  if (!message) throw new AppError('NOT_FOUND', 'Message not found.', 404)
  return message
}

export async function listMessages(
  db: Db,
  userId: string,
  opts: { offset?: number; limit?: number; unread?: boolean }
) {
  await seedExampleMessages(db, userId)

  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 20

  const where: Prisma.AgentMessageWhereInput = { userId, ...(opts.unread !== undefined ? { read: !opts.unread } : {}) }

  const [messages, total] = await Promise.all([
    db.agentMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    db.agentMessage.count({ where }),
  ])

  return { messages, hasMore: offset + limit < total }
}

export async function markRead(db: Db, userId: string, messageId: string) {
  await findOwnedMessage(db, userId, messageId)
  return db.agentMessage.update({
    where: { id: messageId },
    data: { read: true },
  })
}

export async function deleteMessage(db: Db, userId: string, messageId: string): Promise<void> {
  await findOwnedMessage(db, userId, messageId)
  await db.agentMessage.delete({ where: { id: messageId } })
}

export async function createMessage(
  db: Db,
  userId: string,
  agentId: string,
  title: string,
  body: string
) {
  return db.agentMessage.create({
    data: {
      userId,
      agentId,
      title,
      body,
    },
  })
}
