import type { PrismaClient } from '../generated/prisma/client'
import type { Env } from '../types'
import { encrypt, decrypt } from '../lib/crypto'
import {
  SCOPES,
  refreshAccessToken,
  revokeTokens,
  type TokenData,
} from './gmail.service'

export const GMAIL_PROVIDER = 'gmail'
export const REFRESH_MARGIN_SECONDS = 60

const GMAIL_SCOPES = SCOPES.split(' ')

const accessTokenCache = new Map<string, { accessToken: string; expiresAt: number }>()

export async function getIntegrationAccount(
  db: PrismaClient,
  userId: string,
  provider: string = GMAIL_PROVIDER
) {
  return db.integrationAccount.findFirst({ where: { userId, provider } })
}

export async function connectGmail(
  db: PrismaClient,
  userId: string,
  tokens: TokenData,
  email: string,
  secretHex: string
) {
  const refreshToken = tokens.refresh_token
  if (!refreshToken) {
    throw new Error('Google returned no refresh token; revoke access and reconnect')
  }

  const tokenEnc = await encrypt(refreshToken, secretHex)
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000)

  const row = await db.integrationAccount.upsert({
    where: { userId_provider_email: { userId, provider: GMAIL_PROVIDER, email } },
    create: {
      userId,
      provider: GMAIL_PROVIDER,
      email,
      tokenEnc,
      tokenExpiry,
      scope: GMAIL_SCOPES,
    },
    update: { tokenEnc, tokenExpiry, scope: GMAIL_SCOPES },
  })

  accessTokenCache.set(row.id, {
    accessToken: tokens.access_token,
    expiresAt: tokenExpiry.getTime(),
  })

  return { id: row.id, email: row.email ?? email }
}

export async function getGmailAccessToken(
  db: PrismaClient,
  userId: string,
  env: Env
): Promise<string | null> {
  const account = await getIntegrationAccount(db, userId)
  if (!account?.tokenEnc) return null

  const cached = accessTokenCache.get(account.id)
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_SECONDS * 1000) {
    return cached.accessToken
  }
  accessTokenCache.delete(account.id)

  let refreshToken: string
  try {
    refreshToken = await decrypt(account.tokenEnc, env.INTEGRATION_ENCRYPTION_KEY)
  } catch {
    return null
  }

  let tokens: TokenData
  try {
    tokens = await refreshAccessToken(
      refreshToken,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    )
  } catch {
    return null
  }

  const expiresAt = Date.now() + tokens.expires_in * 1000
  accessTokenCache.set(account.id, { accessToken: tokens.access_token, expiresAt })
  await db.integrationAccount.update({
    where: { id: account.id },
    data: { tokenExpiry: new Date(expiresAt) },
  })

  return tokens.access_token
}

export async function disconnectGmail(
  db: PrismaClient,
  userId: string,
  env: Env
): Promise<boolean> {
  const account = await getIntegrationAccount(db, userId)
  if (!account?.tokenEnc) return false

  try {
    const refreshToken = await decrypt(account.tokenEnc, env.INTEGRATION_ENCRYPTION_KEY)
    await revokeTokens(refreshToken, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
  } catch {
    // The local row is removed regardless; a stale server-side grant is harmless.
  }

  accessTokenCache.delete(account.id)
  await db.integrationAccount.delete({ where: { id: account.id } })
  return true
}
