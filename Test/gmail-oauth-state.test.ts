import { SignJWT } from 'jose'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GMAIL_STATE_TTL_SECONDS,
  buildGmailState,
  createNonce,
  deriveStateKey,
  verifyGmailState,
} from '../apps/backend/src/lib/gmail-oauth-state.ts'
import { verifyAccessToken } from '../apps/backend/src/lib/jwt.ts'

const SECRET = 'a'.repeat(64)

test('round-trips userId and nonce', async () => {
  const state = await buildGmailState('user-1', 'nonce-abc', SECRET)
  const out = await verifyGmailState(state, SECRET)
  assert.equal(out.userId, 'user-1')
  assert.equal(out.nonce, 'nonce-abc')
})

test('rejects a state signed with a different secret', async () => {
  const state = await buildGmailState('user-1', 'nonce-abc', SECRET)
  await assert.rejects(() => verifyGmailState(state, 'b'.repeat(64)))
})

test('rejects a tampered payload', async () => {
  const state = await buildGmailState('user-1', 'nonce-abc', SECRET)
  const [header, , signature] = state.split('.')
  const forged = Buffer.from(JSON.stringify({ sub: 'attacker', nonce: 'x' })).toString(
    'base64url'
  )
  await assert.rejects(() => verifyGmailState(`${header}.${forged}.${signature}`, SECRET))
})

test('rejects a malformed state', async () => {
  await assert.rejects(() => verifyGmailState('not-a-jwt', SECRET))
  await assert.rejects(() => verifyGmailState('', SECRET))
})

test('nonce is random and URL safe', () => {
  const a = createNonce()
  const b = createNonce()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]+$/)
  assert.ok(a.length >= 22)
})

test('state ttl is exactly ten minutes', () => {
  assert.equal(GMAIL_STATE_TTL_SECONDS, 600)
})

test('state expiration is ten minutes after issuance', async () => {
  const state = await buildGmailState('user-1', 'nonce-abc', SECRET)
  const payloadB64 = state.split('.')[1]
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
    exp: number
    iat: number
  }
  assert.equal(payload.exp - payload.iat, 600)
})

test('rejects an expired state', async () => {
  const state = await new SignJWT({ nonce: 'nonce-abc' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime('-1s')
    .sign(await deriveStateKey(SECRET))
  await assert.rejects(() => verifyGmailState(state, SECRET))
})

test('rejects a correctly signed state without an expiration', async () => {
  const state = await new SignJWT({ nonce: 'nonce-abc' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .sign(await deriveStateKey(SECRET))
  await assert.rejects(() => verifyGmailState(state, SECRET))
})

test('a state token cannot be used as a Bearer access token', async () => {
  const state = await buildGmailState('user-1', 'nonce-abc', SECRET)
  await assert.rejects(() => verifyAccessToken(state, SECRET))
})
