import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GMAIL_STATE_TTL_SECONDS,
  buildGmailState,
  createNonce,
  verifyGmailState,
} from '../apps/backend/src/lib/gmail-oauth-state.ts'

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

test('state ttl is short', () => {
  assert.ok(GMAIL_STATE_TTL_SECONDS > 0)
  assert.ok(GMAIL_STATE_TTL_SECONDS <= 900)
})
