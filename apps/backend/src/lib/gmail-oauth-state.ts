import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'
const STATE_KEY_INFO = 'gmail-oauth-state:v1'

export const GMAIL_STATE_TTL_SECONDS = 600

export async function deriveStateKey(jwtSecret: string): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const derived = await crypto.subtle.sign(
    'HMAC',
    base,
    new TextEncoder().encode(STATE_KEY_INFO)
  )
  return new Uint8Array(derived)
}

export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function buildGmailState(
  userId: string,
  nonce: string,
  jwtSecret: string
): Promise<string> {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${GMAIL_STATE_TTL_SECONDS}s`)
    .sign(await deriveStateKey(jwtSecret))
}

export async function verifyGmailState(
  state: string,
  jwtSecret: string
): Promise<{ userId: string; nonce: string }> {
  if (!state) throw new Error('Missing OAuth state')
  const { payload } = await jwtVerify(state, await deriveStateKey(jwtSecret), {
    algorithms: [ALG],
  })
  if (typeof payload.exp !== 'number') throw new Error('OAuth state is missing expiration')
  const userId = payload.sub
  const nonce = payload.nonce
  if (!userId) throw new Error('OAuth state is missing subject')
  if (typeof nonce !== 'string' || !nonce) throw new Error('OAuth state is missing nonce')
  return { userId, nonce }
}
