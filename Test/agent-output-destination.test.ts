import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolveOutputDestination } from '../apps/backend/src/lib/output-destination.ts'

const runnerSource = await readFile('apps/backend/src/services/agent.runner.ts', 'utf8')
const agentsPageSource = await readFile('apps/web/src/features/agents/AgentsPage.tsx', 'utf8')
const dtoSource = await readFile('apps/web/src/global/repositories/agents.repository.ts', 'utf8')
const storeSource = await readFile('apps/web/src/global/stores/useAgentsStore.ts', 'utf8')
const historySource = await readFile('apps/web/src/features/agents/RunHistory.tsx', 'utf8')

test('output=message and output=email land in the inbox', () => {
  assert.equal(resolveOutputDestination('message'), 'inbox')
  assert.equal(resolveOutputDestination('email'), 'inbox')
})

test('output=note lands in the diary', () => {
  assert.equal(resolveOutputDestination('note'), 'diary')
})

test('an unknown output type writes nowhere', () => {
  assert.equal(resolveOutputDestination(''), 'none')
  assert.equal(resolveOutputDestination('whatever'), 'none')
})

test('resolution is case-insensitive, so a stray "Message" is not silently dropped', () => {
  assert.equal(resolveOutputDestination('Message'), 'inbox')
  assert.equal(resolveOutputDestination('  NOTE  '), 'diary')
})

test('formatOutput reports the destination it actually wrote to', () => {
  // The destination must come from the same resolved value that picked the
  // write, so the inbox and diary branches cannot disagree.
  assert.match(
    runnerSource,
    /const destination = resolveOutputDestination\(outputType\)[\s\S]{0,1400}?if \(destination === 'inbox'\)/
  )
  assert.match(runnerSource, /return \{\s*destination,\s*id: entry\.id/)
  assert.match(runnerSource, /return \{ destination, id: message\.id/)
})

test('every successful run returns a destination', () => {
  assert.match(runnerSource, /destination:\s*resolveOutputDestination\(agent\.output\)/)
})

test('a failed run reports no destination', () => {
  assert.match(runnerSource, /status:\s*'failed',[\s\S]{0,220}?destination:\s*'none'/)
})

test('the run result carries the destination across the API', () => {
  assert.match(dtoSource, /destination\??:\s*OutputDestination/)
  assert.match(storeSource, /destination:\s*result\.destination/)
})

test('the toast names the real destination instead of always claiming the inbox', () => {
  assert.match(agentsPageSource, /destination === 'diary'/)
  assert.match(agentsPageSource, /destination === 'inbox'/)
  assert.doesNotMatch(
    agentsPageSource,
    /if \(result\.message\) \{[\s\S]{0,200}?Output added to your inbox/,
    'the inbox toast must be gated on destination === "inbox", not on a message existing'
  )
})

test('the diary destination does not switch the page to the inbox', () => {
  const diaryBranch = agentsPageSource.split("destination === 'diary'")[1]?.split('}')[0] ?? ''
  assert.doesNotMatch(diaryBranch, /setTab\('inbox'\)/)
})

test('the run and run-list DTOs are distinct shapes', () => {
  // RunResultDto.message is an output record; AgentRunDto.message is a snapshot
  // string. Collapsing them is what let the toast treat a diary entry as an
  // inbox message in the first place.
  // Split on the closing brace at column 0: an inline object type like
  // `message?: { ... }` contains braces that a naive split would cut through.
  const runResult = dtoSource.split('export type RunResultDto')[1]?.split('\n}')[0] ?? ''
  const runList = dtoSource.split('export type AgentRunDto')[1]?.split('\n}')[0] ?? ''

  assert.ok(runResult.length > 0, 'RunResultDto must exist')
  assert.ok(runList.length > 0, 'AgentRunDto must exist for the run-history endpoint')

  assert.doesNotMatch(runResult, /message\?:\s*string/)
  assert.match(runResult, /message\?:\s*\{[^}]*body:\s*string[^}]*\}/)

  assert.match(runList, /message\?:\s*string/)
  assert.match(runList, /startedAt:\s*string/)
  assert.doesNotMatch(runList, /destination/)
})

test('run history consumes the list DTO, not the run DTO', () => {
  assert.match(historySource, /type AgentRunDto/)
  assert.doesNotMatch(historySource, /RunResultDto/)
})