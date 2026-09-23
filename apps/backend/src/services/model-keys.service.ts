import type { Prisma, PrismaClient } from '../generated/prisma/client'
import { encrypt } from '../lib/crypto'
import { AppError } from '../lib/http'

type Db = PrismaClient | Prisma.TransactionClient

async function findOwnedModelKey(db: Db, userId: string, keyId: string) {
  const key = await db.modelKey.findFirst({ where: { id: keyId, userId } })
  if (!key) throw new AppError('NOT_FOUND', 'Model key not found.', 404)
  return key
}

export async function listModelKeys(db: Db, userId: string) {
  return db.modelKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      label: true,
      defaultModel: true,
      baseUrl: true,
      createdAt: true,
    },
  })
}

export async function createModelKey(
  db: Db,
  userId: string,
  input: {
    provider: string
    label: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  },
  encryptionKey: string
) {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${input.apiKey}` },
  })

  if (!response.ok) {
    throw new AppError('INVALID_KEY', 'The provided API key could not be validated against OpenRouter.', 400)
  }

  const apiKeyEnc = await encrypt(input.apiKey, encryptionKey)

  return db.modelKey.create({
    data: {
      userId,
      provider: input.provider,
      label: input.label,
      apiKeyEnc,
      defaultModel: input.defaultModel,
      baseUrl: input.baseUrl ?? null,
    },
    select: {
      id: true,
      provider: true,
      label: true,
      defaultModel: true,
      baseUrl: true,
      createdAt: true,
    },
  })
}

export async function deleteModelKey(db: Db, userId: string, keyId: string): Promise<void> {
  await findOwnedModelKey(db, userId, keyId)
  await db.$transaction(async (tx) => {
    await tx.agent.updateMany({ where: { modelKeyId: keyId }, data: { modelKeyId: null } })
    await tx.modelKey.delete({ where: { id: keyId } })
  })
}
