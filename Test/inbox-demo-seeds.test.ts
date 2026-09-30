import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const seedSource = await readFile('apps/backend/src/services/seed.service.ts', 'utf8')
const messagesSource = await readFile('apps/backend/src/services/messages.service.ts', 'utf8')
const editorSource = await readFile('apps/web/src/features/agents/AgentEditor.tsx', 'utf8')

test('the demo inbox seeds are gone', () => {
  assert.ok(
    !/seedExampleMessages/.test(seedSource),
    'seedExampleMessages must be removed; it wrote fake example.com messages into every real inbox'
  )
  assert.ok(
    !/EXAMPLE_INBOX_MESSAGES/.test(seedSource),
    'the example message fixtures must be removed'
  )
  assert.ok(
    !/example\.com/.test(seedSource),
    'no example.com placeholders should remain in the seed service'
  )
})

test('listing the inbox never writes to it', () => {
  assert.ok(
    !/seedExampleMessages/.test(messagesSource),
    'listMessages must be a pure read; seeding on read is what resurrected the demo rows'
  )
  assert.ok(
    !/createMany|create\(|update\(|delete/.test(messagesSource.split('export async function listMessages')[1]?.split('export async function markRead')[0] ?? ''),
    'listMessages must not mutate the database'
  )
})

test('real seeding of default agents and templates is kept', () => {
  assert.match(seedSource, /export async function seedDefaultAgents/)
  assert.match(seedSource, /export async function seedTemplates/)
  assert.match(seedSource, /export const DEFAULT_AGENTS/)
})

test('the gmail callback outcome is stripped from the hash after being read', () => {
  assert.match(editorSource, /window\.history\.replaceState/)
  assert.match(editorSource, /location\.hash\.split\('\?'\)\[0\]/)
})

test('the outcome is stripped before the await, so a remount cannot re-toast', () => {
  const stripIndex = editorSource.indexOf('window.history.replaceState')
  const refreshIndex = editorSource.indexOf('await refreshGmail()')
  assert.ok(stripIndex > -1, 'replaceState must be called')
  assert.ok(refreshIndex > -1, 'refreshGmail must be called')
  assert.ok(
    stripIndex < refreshIndex,
    'replaceState must precede the await; otherwise the param survives and re-toasts on remount'
  )
})
