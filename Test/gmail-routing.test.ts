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

const integrationsSource = await readFile(
  'apps/backend/src/services/integrations.service.ts',
  'utf8'
)

test('integration service stores the refresh token, never the access token', () => {
  assert.match(integrationsSource, /tokens\.refresh_token/)
  assert.ok(
    !/encrypt\(\s*tokens\.access_token/.test(integrationsSource),
    'access token must never be persisted'
  )
})

test('integration service caches the access token in memory, not in the row', () => {
  assert.match(integrationsSource, /new Map<string, \{ accessToken: string; expiresAt: number \}>/)
  assert.match(integrationsSource, /REFRESH_MARGIN_SECONDS/)
  assert.match(integrationsSource, /refreshAccessToken/)
})

test('integration service upserts on the userId+provider+email compound unique', () => {
  assert.match(integrationsSource, /userId_provider_email/)
  assert.match(integrationsSource, /GMAIL_PROVIDER = 'gmail'/)
  assert.match(integrationsSource, /scope: GMAIL_SCOPES/)
  assert.match(integrationsSource, /GMAIL_SCOPES = SCOPES\.split\(' '\)/)
})

const routerSource = await readFile('apps/backend/src/routes/integrations.router.ts', 'utf8')
const controllerSource = await readFile(
  'apps/backend/src/controllers/integrations.controller.ts',
  'utf8'
)
const indexSource = await readFile('apps/backend/src/index.ts', 'utf8')

test('gmail routes are mounted at the path Google will redirect to', () => {
  assert.match(indexSource, /app\.route\('\/api\/auth\/gmail', integrationsRouter\)/)
  assert.match(routerSource, /'\/connect'/)
  assert.match(routerSource, /'\/callback'/)
  assert.match(routerSource, /'\/status'/)
})

test('callback is reachable without a bearer token, connect is not', () => {
  assert.ok(
    !/'\/callback',\s*authVerify/.test(routerSource),
    'callback must not be behind authVerify'
  )
  assert.match(routerSource, /'\/connect',\s*authVerify/)
  assert.match(routerSource, /'\/status',\s*authVerify/)
})

test('callback validates state against the CSRF cookie and never logs the code', () => {
  assert.match(controllerSource, /verifyGmailState/)
  assert.match(controllerSource, /getCookie\(c, NONCE_COOKIE\)/)
  assert.ok(!/console\.(log|error)\([^)]*\bcode\b/.test(controllerSource))
})

test('controller follows repo conventions: no any, uses handle()', () => {
  assert.ok(!/\bany\b/.test(controllerSource), 'controller must not use any')
  assert.match(controllerSource, /handle\(c, async \(\) => \{/)
  assert.match(controllerSource, /prismaClient\(c\.env\.DATABASE_URL\)/)
})

test('the nonce cookie is httpOnly, Lax-scoped and cleared after use', () => {
  assert.match(controllerSource, /httpOnly: true/)
  assert.match(controllerSource, /sameSite: 'Lax'/)
  assert.match(controllerSource, /setCookie\(c, NONCE_COOKIE, '', \{ path: '\/api\/auth\/gmail', maxAge: 0 \}\)/)
})

test('a mismatched or missing nonce cookie blocks the callback', () => {
  assert.match(controllerSource, /if \(!cookieNonce \|\| cookieNonce !== nonce\)/)
  assert.match(controllerSource, /csrf_failed/)
})

const runnerSource = await readFile('apps/backend/src/services/agent.runner.ts', 'utf8')

test('runner uses the refresh-aware accessor, not raw decrypt', () => {
  assert.match(runnerSource, /getGmailAccessToken/)
  assert.ok(
    !/decrypt\(\s*integration\.tokenEnc/.test(runnerSource),
    'runner must not treat tokenEnc as a live access token'
  )
})

test('runner surfaces a missing Gmail connection instead of skipping silently', () => {
  assert.match(runnerSource, /emailConnectionMissing/)
})

test('runner never logs a token', () => {
  assert.ok(!/console\.(log|error)\([^)]*accessToken/.test(runnerSource))
})

test('runner short-circuits before the LLM call when Gmail is unconnected', () => {
  const marker = runnerSource.indexOf('contextData.emailConnectionMissing')
  const llm = runnerSource.indexOf('generateWithLLM({')
  assert.ok(marker > -1, 'short-circuit missing')
  assert.ok(llm > -1, 'LLM call missing')
  assert.ok(marker < llm, 'short-circuit must precede the LLM call')
  assert.match(runnerSource, /tokensUsed: 0/)
})

const storeSource = await readFile(
  'apps/web/src/global/stores/useIntegrationsStore.ts',
  'utf8'
)
const repoSource = await readFile(
  'apps/web/src/global/repositories/integrations.repository.ts',
  'utf8'
)
const editorSource = await readFile('apps/web/src/features/agents/AgentEditor.tsx', 'utf8')

test('store reads real server state instead of a local toggle', () => {
  assert.match(storeSource, /getGmailStatus/)
  assert.match(storeSource, /startGmailConnect/)
  assert.match(storeSource, /disconnectGmailAccount/)
})

test('connecting leaves the app for Google, it does not fake a connection', () => {
  assert.match(storeSource, /window\.location\.assign/)
  assert.match(repoSource, /\/api\/auth\/gmail\/connect/)
  assert.match(repoSource, /\/api\/auth\/gmail\/status/)
  assert.ok(!/isGmailConnected:\s*true/.test(storeSource), 'must not default to connected')
})

test('editor reflects real connection state and still enables the tool', () => {
  assert.match(editorSource, /useIntegrationsStore/)
  assert.match(editorSource, /Connected: \$\{gmailEmail \?\? 'Gmail'\}/)
  assert.match(editorSource, /if \(!enabled\) toggleTool\(tool\.id\)/)
})

test('callback result is read from the hash, not location.search (HashRouter)', () => {
  assert.match(controllerSource, /#\/agents\?gmail=/)
  assert.match(editorSource, /window\.location\.hash\.split\('\?'\)\[1\]/)
  assert.ok(
    !/URLSearchParams\(window\.location\.search\)/.test(editorSource),
    'HashRouter puts the query after the hash; location.search will be empty'
  )
})
