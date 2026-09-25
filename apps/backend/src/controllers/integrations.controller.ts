import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { prismaClient } from '../db'
import { ok } from '../lib/http'
import { AppError, handle } from '../lib/validate'
import {
  GMAIL_STATE_TTL_SECONDS,
  buildGmailState,
  createNonce,
  verifyGmailState,
} from '../lib/gmail-oauth-state'
import { buildAuthUrl, exchangeCode, fetchGoogleEmail } from '../services/gmail.service'
import {
  connectGmail,
  disconnectGmail,
  getIntegrationAccount,
} from '../services/integrations.service'
import type { Env } from '../types'

const NONCE_COOKIE = 'gmail_oauth_nonce'

function requireGoogleConfig(env: Env): void {
  const missing = (
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const
  ).filter((key) => !env[key])
  if (missing.length > 0) {
    throw new AppError(
      'GMAIL_NOT_CONFIGURED',
      `Missing Google OAuth config: ${missing.join(', ')}`,
      500
    )
  }
}

function agentsRedirect(env: Env, outcome: string): string {
  return `${env.WEB_URL}/#/agents?gmail=${outcome}`
}

export const handleConnectGmail = (c: Context) =>
  handle(c, async () => {
    requireGoogleConfig(c.env)
    const userId = c.get('userId') as string
    const nonce = createNonce()
    const state = await buildGmailState(userId, nonce, c.env.JWT_SECRET)

    setCookie(c, NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/api/auth/gmail',
      maxAge: GMAIL_STATE_TTL_SECONDS,
      secure: c.env.WEB_URL.startsWith('https://'),
    })

    const authUrl = `${buildAuthUrl(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_REDIRECT_URI)}&state=${encodeURIComponent(state)}`
    return ok(c, { authUrl })
  })

export const handleGmailCallback = async (c: Context) => {
  const env = c.env
  try {
    requireGoogleConfig(env)
    const db = prismaClient(env.DATABASE_URL)

    if (c.req.query('error')) {
      return c.redirect(agentsRedirect(env, 'denied'))
    }

    const code = c.req.query('code')
    const state = c.req.query('state')
    if (!code || !state) {
      return c.redirect(agentsRedirect(env, 'invalid_request'))
    }

    const { userId, nonce } = await verifyGmailState(state, env.JWT_SECRET)
    const cookieNonce = getCookie(c, NONCE_COOKIE)
    if (!cookieNonce || cookieNonce !== nonce) {
      return c.redirect(agentsRedirect(env, 'csrf_failed'))
    }
    setCookie(c, NONCE_COOKIE, '', { path: '/api/auth/gmail', maxAge: 0 })

    const tokens = await exchangeCode(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    )
    const email = await fetchGoogleEmail(tokens.access_token)
    await connectGmail(db, userId, tokens, email, env.INTEGRATION_ENCRYPTION_KEY)

    return c.redirect(agentsRedirect(env, 'connected'))
  } catch (error) {
    console.error('[integrations] gmail callback failed:', (error as Error).message)
    return c.redirect(agentsRedirect(env, 'failed'))
  }
}

export const handleGmailStatus = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const account = await getIntegrationAccount(db, c.get('userId') as string)
    return ok(c, { isConnected: Boolean(account), email: account?.email ?? null })
  })

export const handleDisconnectGmail = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const wasConnected = await disconnectGmail(db, c.get('userId') as string, c.env)
    return ok(c, { isConnected: false, wasConnected })
  })
