import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const storeSource = await readFile(
  'apps/web/src/global/stores/useDiaryStore.ts',
  'utf8'
)
const syncSource = await readFile(
  'apps/web/src/global/lib/crossWindowSync.ts',
  'utf8'
)
const mainSource = await readFile('apps/web/src/main.tsx', 'utf8')
const serviceSource = await readFile(
  'apps/backend/src/services/diary.service.ts',
  'utf8'
)

test('the diary store no longer persists to localStorage', () => {
  // Diary entries are private per account, but a localStorage key is shared by
  // every account signing in on the machine, so user B saw user A's entries.
  assert.doesNotMatch(storeSource, /from 'zustand\/middleware'/)
  assert.doesNotMatch(storeSource, /\bpersist\(/)
  assert.doesNotMatch(storeSource, /partialize/)
  assert.doesNotMatch(storeSource, /name: 'ontrack-diary'/)
})

test('the store is not registered for cross-window rehydration', () => {
  // A non-persisted store has no `.persist.rehydrate()`, so leaving it in the
  // sync table would throw on the first storage event. Check the STORES table
  // entries only, so the explanatory comment above it can't trip the assertion.
  const storesTable =
    syncSource.match(/const STORES[^=]*= \[([\s\S]*?)\n\]/)?.[1] ?? ''
  assert.ok(storesTable, 'STORES table not found in crossWindowSync.ts')
  assert.doesNotMatch(storesTable, /diary/i)
  assert.doesNotMatch(syncSource, /import .*useDiaryStore/)
})

test('the stale legacy key is purged at startup', () => {
  // Stopping the read is not enough on its own — without this the previous
  // account's plaintext entries stay on disk forever.
  assert.match(storeSource, /export function purgeLegacyDiaryCache/)
  assert.match(storeSource, /localStorage\.removeItem\(LEGACY_PERSIST_KEY\)/)
  assert.match(mainSource, /purgeLegacyDiaryCache\(\)/)
})

test('the legacy local-seed upload is gone', () => {
  // ensureLoaded used to POST localStorage entries to the server when the
  // account had zero rows, which could resurrect another account's entries
  // into this one.
  const ensureLoaded =
    storeSource.match(/ensureLoaded: async \(\) => \{[\s\S]*?\n    \},/)?.[0] ??
    ''
  assert.doesNotMatch(ensureLoaded, /legacy/)
  assert.doesNotMatch(ensureLoaded, /createDiary\(/)
})

test('the hidden/locked entry contract still runs through the DB', () => {
  // Dropping local persistence must not weaken the lock: content is still
  // stripped from responses and reveal is still a server-side password check.
  assert.match(serviceSource, /content: entry\.hidden \? '' : entry\.content/)
  assert.match(serviceSource, /hidden: false/)
  assert.match(storeSource, /reveal: async \(id, password\)/)
})
