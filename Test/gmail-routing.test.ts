import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const gmailSource = await readFile('apps/backend/src/services/gmail.service.ts', 'utf8')

test('gmail service exports a refresh-token exchange', () => {
  assert.match(gmailSource, /export async function refreshAccessToken/)
  assert.match(gmailSource, /grant_type:\s*'refresh_token'/)
})

test('gmail service can resolve the connected account email', () => {
  assert.match(gmailSource, /export async function fetchGoogleEmail/)
  assert.match(gmailSource, /openidconnect\.googleapis\.com\/v1\/userinfo/)
})

test('gmail service exposes its scope string for persistence', () => {
  assert.match(gmailSource, /export const SCOPES/)
})

test('revokeTokens checks the response instead of firing and forgetting', () => {
  const start = gmailSource.indexOf('export async function revokeTokens')
  const end = gmailSource.indexOf('export async function', start + 1)
  const revoke = gmailSource.slice(start, end === -1 ? gmailSource.length : end)
  assert.match(revoke, /if \(!res\.ok\)/, 'revokeTokens must verify the response')
  assert.match(revoke, /throw new Error/)
})
