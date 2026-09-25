# Gmail OAuth Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Connect Gmail" button perform a real Google OAuth authorization-code flow that persists an encrypted refresh token to `IntegrationAccount`, so agents holding the `email_read` tool can actually read mail.

**Architecture:** The backend gains four endpoints under `/api/auth/gmail`. Because this app authenticates with Bearer tokens only (no session cookie — `apps/backend/src/middleware/auth.ts:6-8`), the Google callback cannot identify the user from a request header. The `state` parameter therefore carries a short-lived JWT containing `userId` + a random `nonce`, and the same `nonce` is mirrored into a `SameSite=Lax` HttpOnly cookie so the callback can prove it is the same browser that started the flow (CSRF).

`IntegrationAccount.tokenEnc` stores the AES-GCM encrypted **refresh token** only — never an access token. Access tokens live in a module-level in-memory cache scoped to the Worker isolate, so a 1-hour expiry never hits the database and nothing sensitive is written twice. On a cache miss the accessor refreshes and writes only the new `tokenExpiry` back to the row.

**Tech Stack:** Hono (Cloudflare Worker), Prisma/Postgres, `jose` (already a dependency), React 19 + Zustand.

**Spec:** This plan. No separate spec doc exists; `DATAMODEL.md:590-596` documents the intended endpoints and is currently inaccurate — Task 7 reconciles it.

## Global Constraints

- Never add a dependency. `jose`, Prisma, React, Zustand, Hono and Zod are all already used.
- Never hand-edit `apps/backend/src/generated/prisma/**` or any lock file.
- `INTEGRATION_ENCRYPTION_KEY` is a 64-char hex string; `encrypt`/`decrypt` from `apps/backend/src/lib/crypto.ts` require exactly that.
- Tests run from the repo root via `npm test` → `node --experimental-strip-types --test "Test/*.test.ts"`.
- Test modules under `Test/` may only import via explicit `.ts` extensions, and any module they import must have **zero relative imports** (strip-only mode cannot resolve them).
- Backend controllers use `Context` from `hono` (unparameterized), the `handle(c, fn)` wrapper from `apps/backend/src/lib/validate.ts`, and `prismaClient(c.env.DATABASE_URL)` from `apps/backend/src/db`. Do not introduce `any`, a `getPrisma` helper, or a new `AppError` construction style.
- Frontend repositories use `api<T>(path, init?)` from `apps/web/src/global/lib/api.ts`. It returns `body.data` directly — do **not** unwrap an envelope. Paths include the `/api` prefix.
- Toasts use `useToastStore.getState().push({ title, message?, level })` where `level` is `'info' | 'warn' | 'error'`.
- **Source-text assertions must be non-vacuous.** A module that imports relative paths cannot be loaded by `Test/` under strip-only mode, so Tasks 3-6 verify wiring by matching source text. Two rules make such assertions meaningful: anchor every pattern on a string unique to the code under test (never a substring that also appears in a nearby constant — e.g. `/userinfo/` matches the pre-existing `SCOPES` literal at `gmail.service.ts:19`), and bound any function-body slice at the NEXT `export async function` rather than at end-of-file, because a slice to EOF silently swallows every function appended after the one under test.
- Verification gate before claiming any task done: `npm test`, then `npm run build`, then `npm run lint`.

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/backend/src/lib/gmail-oauth-state.ts` (create) | Sign/verify the OAuth `state` JWT. Dependency-free so it is unit testable. |
| `apps/backend/src/services/gmail.service.ts` (modify) | Add `fetchGoogleEmail`, `refreshAccessToken`; export `SCOPES`/`TokenData`; harden `revokeTokens`. |
| `apps/backend/src/services/integrations.service.ts` (create) | All `IntegrationAccount` DB access plus the refresh-aware `getGmailAccessToken` with its in-memory cache. |
| `apps/backend/src/controllers/integrations.controller.ts` (create) | Request/response handling only. |
| `apps/backend/src/routes/integrations.router.ts` (create) | Route wiring only. |
| `apps/backend/src/index.ts` (modify) | Mount the router. |
| `apps/backend/src/services/agent.runner.ts` (modify) | Consume the refresh-aware accessor; stop skipping silently. |
| `apps/web/src/global/repositories/integrations.repository.ts` (create) | Typed `api<T>` wrappers. |
| `apps/web/src/global/stores/useIntegrationsStore.ts` (create) | Connection status plus connect/disconnect actions. |
| `apps/web/src/features/agents/AgentEditor.tsx` (modify) | Replace the fake toggle with the real flow. |
| `Test/gmail-oauth-state.test.ts` (create) | State signing, verification, tamper and nonce tests. |
| `Test/gmail-routing.test.ts` (create) | Source-text assertions that the wiring exists and the fake toggle is gone. |

---

### Task 1: OAuth state JWT

The callback cannot use `authVerify`, so identity must travel inside `state`. It must be tamper-proof and expire quickly.

**Files:**
- Create: `apps/backend/src/lib/gmail-oauth-state.ts`
- Test: `Test/gmail-oauth-state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GMAIL_STATE_TTL_SECONDS = 600`
  - `buildGmailState(userId: string, nonce: string, jwtSecret: string): Promise<string>`
  - `verifyGmailState(state: string, jwtSecret: string): Promise<{ userId: string; nonce: string }>`
  - `createNonce(): string`

- [ ] **Step 1: Write the failing test**

Create `Test/gmail-oauth-state.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `gmail-oauth-state.ts`.

- [ ] **Step 3: Implement `gmail-oauth-state.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `gmail-oauth-state` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/gmail-oauth-state.ts Test/gmail-oauth-state.test.ts
git commit -m "feat(integrations): add signed CSRF state for Gmail OAuth"
```

---

### Task 2: Gmail service additions

**Files:**
- Modify: `apps/backend/src/services/gmail.service.ts:11-16` (export `TokenData`), `:18` (export `SCOPES`), append new functions, replace `:100-113` (`revokeTokens`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const SCOPES: string` — the existing scope string, now exported
  - `export type TokenData = { access_token: string; refresh_token?: string; expires_in: number; token_type: string; scope?: string }`
  - `export async function fetchGoogleEmail(accessToken: string): Promise<string>`
  - `export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<TokenData>`

- [ ] **Step 1: Write the failing source-text test**

Create `Test/gmail-routing.test.ts` with this content:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the assertions do not match.

- [ ] **Step 3: Implement the service additions**

In `apps/backend/src/services/gmail.service.ts`:

1. Change `type TokenData = {` to `export type TokenData = {` and add `scope?: string` to it.
2. Change `const SCOPES =` to `export const SCOPES =`.
3. Append these functions:

```ts
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`)
  }
  const data = (await res.json()) as { email?: string; email_verified?: boolean }
  if (!data.email) throw new Error('Google account has no email address')
  if (data.email_verified === false) {
    throw new Error('Google account email is not verified')
  }
  return data.email
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenData> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${err}`)
  }
  return res.json() as Promise<TokenData>
}
```

4. Replace the `revokeTokens` body with a response check:

```ts
export async function revokeTokens(
  refreshToken: string,
  clientId: string,
  _clientSecret: string
): Promise<void> {
  const res = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: refreshToken,
      client_id: clientId,
    }),
  })
  if (!res.ok) {
    throw new Error(`Token revoke failed: ${res.status}`)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: the four Task 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/gmail.service.ts Test/gmail-routing.test.ts
git commit -m "feat(gmail): add refresh-token and userinfo support"
```

---

### Task 3: IntegrationAccount service

The subtlety: we persist **only** the refresh token, so an access token can never be reconstructed without a network call. Caching it per isolate avoids that call on every run while keeping the database free of access tokens.

**Files:**
- Create: `apps/backend/src/services/integrations.service.ts`

**Interfaces:**
- Consumes: `SCOPES`, `TokenData`, `fetchGoogleEmail`, `refreshAccessToken`, `revokeTokens` from Task 2; `encrypt`/`decrypt` from `../lib/crypto`; `Env` from `../types`; `PrismaClient` from `../generated/prisma/client`.
- Produces:
  - `GMAIL_PROVIDER = 'gmail'`
  - `REFRESH_MARGIN_SECONDS = 60`
  - `getIntegrationAccount(db, userId, provider?): Promise<IntegrationAccount | null>`
  - `connectGmail(db, userId, tokens: TokenData, email: string, secretHex: string): Promise<{ id: string; email: string }>`
  - `getGmailAccessToken(db, userId, env: Env): Promise<string | null>` — returns a usable access token, refreshing on cache miss/near-expiry. `null` when not connected or the grant is dead.
  - `disconnectGmail(db, userId, env: Env): Promise<boolean>` — revokes best-effort, then deletes. Returns whether a row existed.

- [ ] **Step 1: Write the failing test**

Append to `Test/gmail-routing.test.ts`:

```ts
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
  assert.match(integrationsSource, /scope: SCOPES/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `ENOENT` for the service.

- [ ] **Step 3: Implement `integrations.service.ts`**

```ts
import type { PrismaClient } from '../generated/prisma/client'
import type { Env } from '../types'
import { encrypt, decrypt } from '../lib/crypto'
import {
  SCOPES,
  fetchGoogleEmail,
  refreshAccessToken,
  revokeTokens,
  type TokenData,
} from './gmail.service'

export const GMAIL_PROVIDER = 'gmail'
export const REFRESH_MARGIN_SECONDS = 60

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
      scope: SCOPES,
    },
    update: { tokenEnc, tokenExpiry, scope: SCOPES },
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: the three Task 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/integrations.service.ts Test/gmail-routing.test.ts
git commit -m "feat(integrations): persist encrypted Gmail refresh tokens"
```

---

### Task 4: Controller and router

**Files:**
- Create: `apps/backend/src/controllers/integrations.controller.ts`
- Create: `apps/backend/src/routes/integrations.router.ts`
- Modify: `apps/backend/src/index.ts:3-12` (import), `:28-37` (mount)

**Interfaces:**
- Consumes: everything from Tasks 1-3; `ok`, `fail`, `AppError` from `../lib/http`; `handle` from `../lib/validate`; `authVerify` from `../middleware/auth`; `prismaClient` from `../db`.
- Produces: `GET /api/auth/gmail/connect`, `GET /api/auth/gmail/callback`, `GET /api/auth/gmail/status`, `DELETE /api/auth/gmail`.

The callback must **not** use `authVerify`, because Google redirects the browser there and no `Authorization` header is present.

- [ ] **Step 1: Write the failing test**

Append to `Test/gmail-routing.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Implement the controller**

`apps/backend/src/controllers/integrations.controller.ts`:

```ts
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
    throw new AppError('GMAIL_NOT_CONFIGURED', `Missing Google OAuth config: ${missing.join(', ')}`, 500)
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
```

The callback is the one handler that does **not** use `handle(c, fn)`. `handle` renders a JSON error envelope, but this endpoint is a browser navigation — a misconfigured server must send the visitor somewhere readable instead. The explicit `try/catch` redirects with `?gmail=failed` and logs only the error message, never the authorization code.

- [ ] **Step 4: Implement the router and mount it**

`apps/backend/src/routes/integrations.router.ts`:

```ts
import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/integrations.controller'

const integrationsRouter = new Hono()

integrationsRouter.get('/connect', authVerify, ctrl.handleConnectGmail)
integrationsRouter.get('/callback', ctrl.handleGmailCallback)
integrationsRouter.get('/status', authVerify, ctrl.handleGmailStatus)
integrationsRouter.delete('/', authVerify, ctrl.handleDisconnectGmail)

export default integrationsRouter
```

In `apps/backend/src/index.ts`, add the import alongside the other router imports:

```ts
import integrationsRouter from './routes/integrations.router'
```

and add the mount immediately after `app.route('/api/auth', authRouter)`:

```ts
app.route('/api/auth/gmail', integrationsRouter)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: the four Task 4 tests PASS.

- [ ] **Step 6: Confirm the backend still bundles**

Run: `npx wrangler deploy --dry-run` from `apps/backend`
Expected: bundles with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/controllers/integrations.controller.ts apps/backend/src/routes/integrations.router.ts apps/backend/src/index.ts Test/gmail-routing.test.ts
git commit -m "feat(integrations): add Gmail OAuth connect, callback and status routes"
```

---

### Task 5: Runner consumes the refresh-aware accessor

Today `apps/backend/src/services/agent.runner.ts:49-59` decrypts `tokenEnc` and hands it straight to Gmail. Once Task 3 stores a refresh token there, that path yields a 401 on the first run. This task fixes it before any user connects.

**Files:**
- Modify: `apps/backend/src/services/agent.runner.ts:1-63` and the run-result construction
- Test: `Test/gmail-routing.test.ts`

**Interfaces:**
- Consumes: `getGmailAccessToken(db, userId, env)` from Task 3.
- Produces: unchanged `gatherContext` signature, but refresh-aware, with `ContextData.emailConnectionMissing` set when the tool is enabled and no usable grant exists.

- [ ] **Step 1: Write the failing test**

Append to `Test/gmail-routing.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL on the first two assertions.

- [ ] **Step 3: Rewrite the email branch**

Add the import:

```ts
import { getGmailAccessToken } from './integrations.service'
```

Add `emailConnectionMissing?: boolean` to the `ContextData` type. Replace the `hasEmail` block at `apps/backend/src/services/agent.runner.ts:47-60` with:

```ts
  const hasEmail = enabledToolNames.has('email_read')
  if (hasEmail) {
    const accessToken = await getGmailAccessToken(db, userId, env)
    if (!accessToken) {
      result.emailConnectionMissing = true
    } else {
      try {
        result.emails = await fetchRecentEmails(accessToken, 24)
      } catch {
        console.error('[runner] gmail fetch failed')
      }
    }
  }
```

Remove the `decrypt` import only if nothing else uses it — in practice
`apps/backend/src/services/agent.runner.ts:186` decrypts the model key with it, so
**keep the import**. Only the Gmail branch stops using `decrypt`.

- [ ] **Step 4: Short-circuit before the LLM call when Gmail is unusable**

`agent.tools` is already loaded by the existing query at
`apps/backend/src/services/agent.runner.ts:174` (`include: { modelKey: true, tools: true }`).

`RunResult.message` is `{ id, title, body }`, not a string — see the existing success return at
`:268-277`. Reuse `formatOutput` so the explanation becomes a real inbox message the user can
re-read, and so the frontend's existing "Output added to your inbox" path fires.

Insert this immediately after `const contextData = await gatherContext(...)` at `:215`, before
`buildSystemPrompt` is called, so no tokens are spent on a run that cannot succeed:

```ts
    if (contextData.emailConnectionMissing) {
      const explanation =
        'This agent needs Gmail, but no Google account is connected. ' +
        'Open the agent, choose Connect Gmail, then run it again.'
      const noticeId = await formatOutput(
        db,
        userId,
        agentId,
        agent.output,
        explanation,
        agent.name
      )
      await db.agentRun.update({
        where: { id: run.id },
        data: { status: 'success', outputSnap: explanation, finishedAt: new Date() },
      })
      await db.agent.update({
        where: { id: agentId },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      })
      return {
        runId: run.id,
        status: 'success',
        ...(noticeId ? { message: noticeId } : {}),
        tokensUsed: 0,
        durationMs: Date.now() - started,
      }
    }
```

`formatOutput` already returns `{ id, title, body } | null` and is declared above `runAgent`, so
no signature change is needed. Do not add fields to `RunResult` or `RunResultDto`.

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: 0 failures.

Run: `npx wrangler deploy --dry-run` from `apps/backend`
Expected: bundles cleanly.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/agent.runner.ts Test/gmail-routing.test.ts
git commit -m "fix(agents): refresh Gmail tokens and report missing connection"
```

---

### Task 6: Frontend connect flow

The button currently lies. It shows "Connected" after only toggling local state (`apps/web/src/features/agents/AgentEditor.tsx:273-274`).

**Files:**
- Create: `apps/web/src/global/repositories/integrations.repository.ts`
- Create: `apps/web/src/global/stores/useIntegrationsStore.ts`
- Modify: `apps/web/src/features/agents/AgentEditor.tsx:89-108` (state/effect), `:257-289` (OAuth button)
- Test: `Test/gmail-routing.test.ts`

**Interfaces:**
- Consumes: the four routes from Task 4.
- Produces: `useIntegrationsStore` with `{ isConnected, email, loadStatus, ensureLoaded, refresh, connect, disconnect }`, and an `AgentEditor` that redirects to Google and reflects the true connection state.

- [ ] **Step 1: Write the failing test**

Append to `Test/gmail-routing.test.ts`:

```ts
const editorSource = await readFile('apps/web/src/features/agents/AgentEditor.tsx', 'utf8')

test('Connect Gmail no longer lies about being connected', () => {
  assert.ok(
    !/enabled \? 'Connected' : `Connect \$\{tool\.oauthProvider\}`/.test(editorSource),
    'connection label must come from real OAuth status, not a local toggle'
  )
  assert.match(editorSource, /useIntegrationsStore/)
  assert.match(editorSource, /connect\(\)/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the fake label is still present.

- [ ] **Step 3: Create the repository**

`apps/web/src/global/repositories/integrations.repository.ts`:

```ts
import { api } from '../lib/api'

export type GmailStatus = {
  isConnected: boolean
  email: string | null
}

export async function getGmailStatus(): Promise<GmailStatus> {
  return api<GmailStatus>('/api/auth/gmail/status')
}

export async function startGmailConnect(): Promise<string> {
  const result = await api<{ authUrl: string }>('/api/auth/gmail/connect')
  return result.authUrl
}

export async function disconnectGmailAccount(): Promise<boolean> {
  const result = await api<{ wasConnected: boolean }>('/api/auth/gmail', {
    method: 'DELETE',
  })
  return result.wasConnected
}
```

- [ ] **Step 4: Create the store**

`apps/web/src/global/stores/useIntegrationsStore.ts`:

```ts
import { create } from 'zustand'
import { isAuthError, toErrorMessage } from '../lib/api'
import {
  disconnectGmailAccount,
  getGmailStatus,
  startGmailConnect,
} from '../repositories/integrations.repository'
import { useToastStore } from './useToastStore'

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

type IntegrationsStore = {
  isConnected: boolean
  email: string | null
  loadStatus: LoadStatus
  ensureLoaded: () => Promise<void>
  refresh: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

export const useIntegrationsStore = create<IntegrationsStore>()((set, get) => ({
  isConnected: false,
  email: null,
  loadStatus: 'idle',

  ensureLoaded: async () => {
    if (get().loadStatus === 'loading' || get().loadStatus === 'loaded') return
    await get().refresh()
  },

  refresh: async () => {
    set({ loadStatus: 'loading' })
    try {
      const status = await getGmailStatus()
      set({ isConnected: status.isConnected, email: status.email, loadStatus: 'loaded' })
    } catch (error) {
      if (!isAuthError(error)) set({ loadStatus: 'error' })
    }
  },

  connect: async () => {
    try {
      window.location.href = await startGmailConnect()
    } catch (error) {
      useToastStore.getState().push({
        title: 'Could not start Gmail connection',
        message: toErrorMessage(error),
        level: 'error',
      })
    }
  },

  disconnect: async () => {
    try {
      await disconnectGmailAccount()
      set({ isConnected: false, email: null, loadStatus: 'loaded' })
      useToastStore.getState().push({
        title: 'Gmail disconnected',
        message: 'The saved Google grant was removed.',
        level: 'info',
      })
    } catch (error) {
      useToastStore.getState().push({
        title: 'Could not disconnect Gmail',
        message: toErrorMessage(error),
        level: 'error',
      })
    }
  },
}))
```

- [ ] **Step 5: Wire `AgentEditor`**

In `apps/web/src/features/agents/AgentEditor.tsx`:

1. Import `useIntegrationsStore` and select the five values the component needs, renaming
   `email` to `gmailEmail` at the selector so it cannot be confused with a user email elsewhere
   in the editor:

```ts
  const isGmailConnected = useIntegrationsStore((state) => state.isConnected)
  const gmailEmail = useIntegrationsStore((state) => state.email)
  const ensureLoaded = useIntegrationsStore((state) => state.ensureLoaded)
  const refresh = useIntegrationsStore((state) => state.refresh)
  const connect = useIntegrationsStore((state) => state.connect)
  const disconnect = useIntegrationsStore((state) => state.disconnect)
```
2. In the component's existing mount effect, call `void ensureLoaded()`.
3. Add a second mount effect that reads the redirect outcome and reports it:

```ts
useEffect(() => {
  const outcome = new URLSearchParams(window.location.search).get('gmail')
  if (!outcome) return
  const messages: Record<string, string> = {
    connected: ['Gmail connected', 'This agent can now read your email.'],
    denied: ['Gmail not connected', 'You declined the Google consent screen.'],
    csrf_failed: ['Gmail connection blocked', 'The security check failed. Try connecting again.'],
    invalid_request: ['Gmail connection failed', 'Google did not return an authorization code.'],
    failed: ['Gmail connection failed', 'Google rejected the connection. Check the OAuth client config.'],
  }
  const entry = messages[outcome]
  if (entry) {
    useToastStore.getState().push({
      title: entry[0],
      message: entry[1],
      level: outcome === 'connected' ? 'info' : 'error',
    })
  }
  void refresh()
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}, [refresh])
```

4. Replace only the OAuth branch at `:272-289`, leaving the wrapper `<div>` at `:260-267` and the
   text block at `:268-271` untouched. `toggleTool` must no longer be called for an OAuth tool, and
   the label must come from the real connection state:

```tsx
                          {tool.requiresOAuth ? (
                            isGmailConnected ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void disconnect()}
                                title={
                                  gmailEmail
                                    ? `Connected as ${gmailEmail} — click to disconnect`
                                    : 'Click to disconnect'
                                }
                              >
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void connect()}
                              >
                                {`Connect ${tool.oauthProvider}`}
                              </Button>
                            )
                          ) : (
                            <button
                              onClick={() => toggleTool(tool.id)}
                              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                                enabled ? 'bg-(--success)' : 'bg-(--border-strong)'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                  enabled ? 'left-[18px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                          )}
```

`toggleTool` stays in use for the non-OAuth branch. Selecting a Gmail tool no longer toggles it
into the agent's tool list by itself — after a successful connect, the user still clicks the
toggle to attach the tool to the agent, which is the honest two-step behaviour.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: 0 failures.

Run: `npm run build -w web`
Expected: succeeds — this is the only typecheck for the web workspace.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/global/repositories/integrations.repository.ts apps/web/src/global/stores/useIntegrationsStore.ts apps/web/src/features/agents/AgentEditor.tsx Test/gmail-routing.test.ts
git commit -m "feat(agents): wire Connect Gmail to the real OAuth flow"
```

---

### Task 7: Reconcile the documentation

`DATAMODEL.md:590-596` and `SUGGESTION.md:373-379` describe this flow as existing. After Task 6 it does exist, so the docs must match the shipped paths and record the token-storage decision.

**Files:**
- Modify: `DATAMODEL.md:590-596`
- Modify: `SUGGESTION.md:373-379`

- [ ] **Step 1: Update the endpoint list**

Ensure the documented Gmail endpoints are exactly:

```
GET    /api/auth/gmail/connect     (authVerify)  -> { authUrl }
GET    /api/auth/gmail/callback    (public)      -> 302 to ${WEB_URL}/#/agents?gmail=...
GET    /api/auth/gmail/status      (authVerify)  -> { isConnected, email }
DELETE /api/auth/gmail             (authVerify)  -> { isConnected: false, wasConnected }
```

- [ ] **Step 2: Record the token-storage decision**

Add one line stating that `IntegrationAccount.tokenEnc` holds an AES-GCM encrypted **refresh** token and never an access token, that `tokenExpiry` tracks the last access-token lifetime, and that `getGmailAccessToken` caches access tokens per Worker isolate and refreshes within a 60-second margin.

- [ ] **Step 3: Verify the docs no longer overstate the feature**

Re-read both sections and confirm every claim matches the implemented code, including that `/callback` is deliberately unauthenticated and relies on the signed `state` plus the CSRF nonce cookie.

- [ ] **Step 4: Run the full gate**

Run: `npm test`, then `npm run build`, then `npm run lint`.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add DATAMODEL.md SUGGESTION.md
git commit -m "docs: describe the implemented Gmail OAuth endpoints"
```

---

## Manual Verification (after Task 7)

This cannot be automated — it requires a real browser and a real Google consent screen.

1. Ensure `GOOGLE_REDIRECT_URI` in `apps/backend/.dev.vars` exactly matches an entry in the Google Cloud Console OAuth client's **Authorized redirect URIs**. Add both `http://localhost:7891/api/auth/gmail/callback` and `http://127.0.0.1:7891/api/auth/gmail/callback`.
2. Confirm the OAuth consent screen is configured and, if the app is in **Testing** mode, that this Google account is listed as a test user. Testing mode caps refresh-token lifetime and can silently break reconnects.
3. `npm run dev`, sign in as the app user, open **Agents → edit Email Summarizer**.
4. The Gmail tool must show **Connect Gmail**, never "Connected". If it shows "Connected", Task 6 is incomplete.
5. Click **Connect Gmail**. The browser must navigate to `accounts.google.com`.
6. Approve. The browser must land on `http://localhost:3456/#/agents?gmail=connected` and a success toast must appear.
7. Confirm the row exists and holds a refresh token, not an access token:

```sql
SELECT provider, email, "tokenExpiry", length("tokenEnc")
FROM "IntegrationAccount" WHERE provider = 'gmail';
```

`tokenEnc` must be non-empty, and the `gmail_oauth_nonce` cookie must be gone.

8. Run the Email Summarizer agent. It must now read real mail. Confirm the inbox receives a message or the action modal opens.
9. Disconnect, confirm the row is deleted, then reconnect to prove the round trip is repeatable.

## Out of Scope

- Gmail **send** (`email_send`, `gmail.send` scope). The current scope set is read-only. Adding send requires a consent-screen scope review and a separate decision.
- Multiple Google accounts per user. The compound unique permits it, but `getIntegrationAccount` returns only the first match.
- Durable cross-isolate access-token caching. Cloudflare Workers isolates are ephemeral; a cold isolate simply refreshes again.
- Background/proactive token refresh. Refresh-on-demand is sufficient at current volume.
