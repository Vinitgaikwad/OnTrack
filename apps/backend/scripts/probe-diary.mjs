import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

const here = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(here, '..', '.env'), 'utf8')
const databaseUrl = envRaw.match(/^DATABASE_URL="?([^"\r\n]+)"?$/m)?.[1]
if (!databaseUrl) throw new Error('DATABASE_URL not found in .env')

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:8787'
const PASSWORD = 'ProbePass123!'
const EMAIL = `probe-${Date.now()}@on-track.test`

const pool = new Pool({ connectionString: databaseUrl })
const userId = randomUUID()
const hiddenId = randomUUID()
const hiddenDeleteWithPwdId = randomUUID()
const visibleId = randomUUID()

let failures = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

let token = ''

try {
  await pool.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, true, now(), now())`,
    [userId, EMAIL, 'Probe', bcrypt.hashSync(PASSWORD, 12)]
  )

  console.log(`Probe user: ${EMAIL} (${userId})`)

  const root = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(5_000) })
  if (!root.ok) throw new Error(`backend not reachable: ${root.status}`)

  const signin = await call('/api/auth/signin', { method: 'POST', body: { email: EMAIL, password: PASSWORD }, auth: false })
  check('POST /api/auth/signin gives accessToken', signin.status === 200 && !!signin.json?.data?.accessToken, `status=${signin.status}`)
  token = signin.json?.data?.accessToken ?? ''
  if (!token) throw new Error('no access token')

  const createdHidden = await call('/api/diary', {
    method: 'POST',
    body: { id: hiddenId, date: '2026-09-07', title: 'Secret note', content: 'deep dark content', mood: 'okay', tags: ['private'], hidden: true },
  })
  check('POST /api/diary (hidden) honors client id + strips content', createdHidden.status === 201 && createdHidden.json?.data?.id === hiddenId && createdHidden.json?.data?.content === '', `status=${createdHidden.status}`)

  const createdVisible = await call('/api/diary', {
    method: 'POST',
    body: { id: visibleId, date: '2026-09-06', title: 'Public note', content: 'normal visible content', mood: 'good', tags: [], hidden: false },
  })
  check('POST /api/diary (visible) returns full content', createdVisible.status === 201 && createdVisible.json?.data?.content === 'normal visible content', `status=${createdVisible.status}`)

  const list = await call('/api/diary?month=2026-09&offset=0&limit=5')
  const listHidden = list.json?.data?.entries?.find((e) => e.id === hiddenId)
  const listVisible = list.json?.data?.entries?.find((e) => e.id === visibleId)
  check('GET /api/diary hides content for hidden entry', list.status === 200 && listHidden?.content === '' && listHidden?.hidden === true, `status=${list.status}`)
  check('GET /api/diary keeps content for visible entry', listVisible?.content === 'normal visible content')

  const wrong = await call('/api/diary/unlock', { method: 'POST', body: { id: hiddenId, password: 'wrong-password' } })
  check('unlock wrong password → 403 INVALID_PASSWORD', wrong.status === 403 && wrong.json?.error?.code === 'INVALID_PASSWORD', `status=${wrong.status}`)

  const patchNoPwd = await call(`/api/diary/${hiddenId}`, { method: 'PATCH', body: { title: 'nope' } })
  check('PATCH still-hidden without password → 403 HIDDEN_ENTRY', patchNoPwd.status === 403 && patchNoPwd.json?.error?.code === 'HIDDEN_ENTRY', `status=${patchNoPwd.status}`)

  const patchWithPwd = await call(`/api/diary/${hiddenId}`, { method: 'PATCH', body: { title: 'Renamed secret', password: PASSWORD } })
  check('PATCH still-hidden with password → 200, still stripped', patchWithPwd.status === 200 && patchWithPwd.json?.data?.title === 'Renamed secret' && patchWithPwd.json?.data?.content === '', `status=${patchWithPwd.status}`)

  const right = await call('/api/diary/unlock', { method: 'POST', body: { id: hiddenId, password: PASSWORD } })
  check('unlock correct password → 200 full content + hidden persisted false', right.status === 200 && right.json?.data?.content === 'deep dark content' && right.json?.data?.hidden === false, `status=${right.status}`)

  const afterUnlock = await call('/api/diary?month=2026-09&offset=0&limit=5')
  const peek = afterUnlock.json?.data?.entries?.find((e) => e.id === hiddenId)
  check('unlocked entry is visibly persisted in DB (list shows content, not hidden)', peek?.content === 'deep dark content' && peek?.hidden === false)

  const patchAfter = await call(`/api/diary/${hiddenId}`, { method: 'PATCH', body: { title: 'Visible now' } })
  check('PATCH now-visible entry without password → 200 (gate gone)', patchAfter.status === 200 && patchAfter.json?.data?.title === 'Visible now' && patchAfter.json?.data?.hidden === false, `status=${patchAfter.status}`)

  const rehide = await call(`/api/diary/${hiddenId}`, { method: 'PATCH', body: { hidden: true } })
  check('PATCH re-hide on visible entry → 200, content stripped', rehide.status === 200 && rehide.json?.data?.hidden === true && rehide.json?.data?.content === '', `status=${rehide.status}`)

  const listRehidden = await call('/api/diary?month=2026-09&offset=0&limit=5')
  const rehidden = listRehidden.json?.data?.entries?.find((e) => e.id === hiddenId)
  check('re-hidden entry shows locked again in list', rehidden?.hidden === true && rehidden?.content === '')

  const reveilAgain = await call('/api/diary/unlock', { method: 'POST', body: { id: hiddenId, password: PASSWORD } })
  check('unlock again after re-hide works (loop is legal)', reveilAgain.status === 200 && reveilAgain.json?.data?.hidden === false && reveilAgain.json?.data?.content === 'deep dark content', `status=${reveilAgain.status}`)

  const deleteAfter = await call(`/api/diary/${hiddenId}`, { method: 'DELETE', body: {} })
  check('DELETE now-visible entry without password → 204', deleteAfter.status === 204, `status=${deleteAfter.status}`)

  const createdHidden2 = await call('/api/diary', {
    method: 'POST',
    body: { id: hiddenDeleteWithPwdId, date: '2026-09-05', title: 'Secret two', content: 'still locked', mood: 'low', tags: [], hidden: true },
  })
  check('POST second hidden entry', createdHidden2.status === 201, `status=${createdHidden2.status}`)
  const deleteHiddenDirect = await call(`/api/diary/${hiddenDeleteWithPwdId}`, { method: 'DELETE', body: { password: PASSWORD } })
  check('direct DELETE hidden with password → 204 (API gate retained)', deleteHiddenDirect.status === 204, `status=${deleteHiddenDirect.status}`)

  const unlockVisible = await call('/api/diary/unlock', { method: 'POST', body: { id: visibleId, password: 'whatever' } })
  check('unlock on visible entry returns as-is, no password check', unlockVisible.status === 200 && unlockVisible.json?.data?.content === 'normal visible content', `status=${unlockVisible.status}`)

  const deleteVisible = await call(`/api/diary/${visibleId}`, { method: 'DELETE', body: {} })
  check('DELETE visible entry → 204', deleteVisible.status === 204, `status=${deleteVisible.status}`)

  const badDeleteOther = await call(`/api/diary/${randomUUID()}`, { method: 'DELETE', body: {} })
  check('DELETE unknown id → 404', badDeleteOther.status === 404, `status=${badDeleteOther.status}`)

  const aptId = randomUUID()
  const aptCreate = await call('/api/appointments', {
    method: 'POST',
    body: { id: aptId, kind: 'appointment', title: 'Orig', date: '2026-09-07', startTime: '09:00', endTime: '10:00', color: '#10b981', notes: 'keep me' },
  })
  check('POST /api/appointments creates', aptCreate.status === 201, `status=${aptCreate.status}`)
  const aptPatch = await call(`/api/appointments/${aptId}`, { method: 'PATCH', body: { title: 'Renamed' } })
  const aptChanged = aptPatch.json?.data
  check(
    'PATCH appointment (title only) preserves color/time/notes',
    aptPatch.status === 200 && aptChanged?.title === 'Renamed' && aptChanged?.color === '#10b981' && aptChanged?.startTime === '09:00' && aptChanged?.endTime === '10:00' && aptChanged?.notes === 'keep me',
    `status=${aptPatch.status}`
  )
  await call(`/api/appointments/${aptId}`, { method: 'DELETE', body: {} })
} catch (error) {
  failures += 1
  console.error(`ABORT ${error instanceof Error ? error.message : String(error)}`)
} finally {
  try {
    await pool.query('DELETE FROM "User" WHERE id = $1', [userId])
    console.log(`Cleaned up probe user ${userId}`)
  } catch (error) {
    console.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  await pool.end()
}

console.log(failures === 0 ? '\nALL PROBE CHECKS PASSED' : `\n${failures} PROBE CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1