import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'

export const GMAIL_STATE_TTL_SECONDS = 600

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
    .sign(new TextEncoder().encode(jwtSecret))
}

export async function verifyGmailState(
  state: string,
  jwtSecret: string
): Promise<{ userId: string; nonce: string }> {
  if (!state) throw new Error('Missing OAuth state')
  const { payload } = await jwtVerify(state, new TextEncoder().encode(jwtSecret), {
    algorithms: [ALG],
  })
  const userId = payload.sub
  const nonce = payload.nonce
  if (!userId) throw new Error('OAuth state is missing subject')
  if (typeof nonce !== 'string' || !nonce) throw new Error('OAuth state is missing nonce')
  return { userId, nonce }
}
