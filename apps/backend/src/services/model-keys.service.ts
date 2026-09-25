import type { Prisma, PrismaClient } from '../generated/prisma/client'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { encrypt } from '../lib/crypto'
import { AppError } from '../lib/http'
import { normalizeProvider, resolveBaseUrl, validateApiKey } from '../lib/llm-providers'

type Db = PrismaClient | Prisma.TransactionClient

const KEY_SELECT = {
  id: true,
  provider: true,
  label: true,
  defaultModel: true,
  baseUrl: true,
  createdAt: true,
} as const

async function findOwnedModelKey(db: Db, userId: string, keyId: string) {
  const key = await db.modelKey.findFirst({ where: { id: keyId, userId } })
  if (!key) throw new AppError('NOT_FOUND', 'Model key not found.', 404)
  return key
}

export async function listModelKeys(db: Db, userId: string) {
  return db.modelKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: KEY_SELECT,
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
  encryptionKey: string,
  fetchImpl?: typeof fetch
) {
  // Validate against the provider that will actually serve the request, not
  // always OpenRouter. A DeepSeek key is rejected by OpenRouter's /models, so
  // validating there made it impossible to save a working DeepSeek key at all.
  const validation = await validateApiKey({
    provider: input.provider,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  })
  if (!validation.ok) {
    throw new AppError(
      validation.code,
      validation.message,
      validation.status as ContentfulStatusCode
    )
  }

  // Persist the resolved base URL so a run never has to guess the vendor.
  const provider = normalizeProvider(input.provider) ?? input.provider.trim()
  const baseUrl = resolveBaseUrl(provider, input.baseUrl)

  const apiKeyEnc = await encrypt(input.apiKey, encryptionKey)

  return db.modelKey.create({
    data: {
      userId,
      provider,
      label: input.label,
      apiKeyEnc,
      defaultModel: input.defaultModel,
      baseUrl,
    },
    select: KEY_SELECT,
  })
}

export async function deleteModelKey(db: Db, userId: string, keyId: string): Promise<void> {
  await findOwnedModelKey(db, userId, keyId)
  await db.$transaction(async (tx) => {
    await tx.agent.updateMany({ where: { modelKeyId: keyId }, data: { modelKeyId: null } })
    await tx.modelKey.delete({ where: { id: keyId } })
  })
}
