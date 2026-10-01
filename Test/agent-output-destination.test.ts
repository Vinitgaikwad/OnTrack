import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  OUTPUT_DESTINATION_ORDER,
  resolveOutputDestination,
  resolveOutputDestinations,
} from '../apps/backend/src/lib/output-destination.ts'

const runnerSource = await readFile('apps/backend/src/services/agent.runner.ts', 'utf8')
const agentsPageSource = await readFile('apps/web/src/features/agents/AgentsPage.tsx', 'utf8')
const pickerSource = await readFile('apps/web/src/features/agents/DestinationPicker.tsx', 'utf8')
const catalogueSource = await readFile('apps/web/src/features/agents/output-destinations.ts', 'utf8')
const dtoSource = await readFile('apps/web/src/global/repositories/agents.repository.ts', 'utf8')
const templatesDtoSource = await readFile('apps/web/src/global/repositories/templates.repository.ts', 'utf8')
const storeSource = await readFile('apps/web/src/global/stores/useAgentsStore.ts', 'utf8')
const serviceSource = await readFile('apps/backend/src/services/agents.service.ts', 'utf8')
const controllerSource = await readFile('apps/backend/src/controllers/agents.controller.ts', 'utf8')
const promptsSource = await readFile('apps/backend/src/lib/agent-prompts.ts', 'utf8')
const schemaSource = await readFile('apps/backend/prisma/schema.prisma', 'utf8')
const migrationSource = await readFile(
  'apps/backend/prisma/migrations/20260911120000_agent_output_destinations/migration.sql',
  'utf8'
)

test('each output type maps to exactly one surface', () => {
  assert.equal(resolveOutputDestination('message'), 'inbox')
  assert.equal(resolveOutputDestination('note'), 'notes')
  assert.equal(resolveOutputDestination('calendar'), 'calendar')
})

test('an unknown or unset output type has no surface', () => {
  assert.equal(resolveOutputDestination(''), null)
  assert.equal(resolveOutputDestination('whatever'), null)
  assert.deepEqual(resolveOutputDestinations([]), [])
  assert.deepEqual(resolveOutputDestinations(['whatever', '']), [])
})

test('the retired email output type is gone', () => {
  assert.equal(resolveOutputDestination('email'), null)
  assert.doesNotMatch(schemaSource, /enum AgentOutputType \{[^}]*email/)
})

test('resolution is case-insensitive, so a stray "Message" is not silently dropped', () => {
  assert.equal(resolveOutputDestination('Message'), 'inbox')
  assert.equal(resolveOutputDestination('  CALENDAR  '), 'calendar')
})

test('several destinations resolve together, for a multi-select agent', () => {
  assert.deepEqual(resolveOutputDestinations(['message', 'calendar']), ['inbox', 'calendar'])
  assert.deepEqual(resolveOutputDestinations(['message', 'note']), ['inbox', 'notes'])
  assert.deepEqual(resolveOutputDestinations(['calendar', 'message', 'note']), [
    'inbox',
    'notes',
    'calendar',
  ])
})

test('the resolved set is deduplicated and written in a stable order', () => {
  // Whatever order the stored array is in, a run must report its surfaces the
  // same way — the toast and the store refresh both read this order.
  assert.deepEqual(resolveOutputDestinations(['calendar', 'message']), ['inbox', 'calendar'])
  assert.deepEqual(resolveOutputDestinations(['message', 'message', 'note']), ['inbox', 'notes'])
  assert.deepEqual(OUTPUT_DESTINATION_ORDER, ['inbox', 'notes', 'calendar'])
})

test('a run writes every selected surface, not just the first', () => {
  // One pass over the resolved destinations, so a second selection cannot be
  // silently skipped the way a single `if` chain would skip it.
  assert.match(runnerSource, /for \(const destination of destinations\)/)
  assert.match(runnerSource, /if \(destination === 'inbox'\)/)
  assert.match(runnerSource, /if \(destination === 'notes'\)/)
  assert.doesNotMatch(runnerSource, /resolveOutputDestination\(outputType\)/)
})

test('each reported record names the surface it actually landed on', () => {
  assert.match(runnerSource, /destination: 'notes',/)
  assert.match(runnerSource, /destination: 'calendar',/)
  assert.match(runnerSource, /destination: 'inbox',/)
  // The calendar destination reports a note as a note, and flags that it stands
  // in for calendar — the UI must not claim a calendar entry was created.
  assert.match(runnerSource, /fallbackFrom\?: OutputDestination/)
  assert.match(runnerSource, /writeNote\(titleFromOutput\(agentName, aiText\), 'calendar'\)/)
})

test('the calendar destination falls back to a note only when no date was found', () => {
  assert.match(runnerSource, /action\.kind === 'event' && action\.date/)
  assert.match(runnerSource, /if \(dated\.length === 0\)/)
  // ...and it must not double up when the notes destination already wrote the
  // same text.
  assert.match(runnerSource, /if \(!wroteNotes\.value\)/)
})

test('events the calendar already wrote are withheld from the approval modal', () => {
  // Otherwise approving the run would create a second appointment for the same
  // [EVENT] line.
  assert.match(runnerSource, /pendingActions\.filter\(\(action\) => !written\.consumed\.includes\(action\)\)/)
})

test('every successful run reports destinations and the rows written', () => {
  assert.match(runnerSource, /destinations: written\.destinations,[\s\S]{0,80}?output: written\.records,/)
})

test('a failed run reports no destinations and no rows', () => {
  assert.match(runnerSource, /status: 'failed',[\s\S]{0,120}?destinations: \[\],[\s\S]{0,40}?output: \[\],/)
})

test('the agent stores a set of destinations, not a single value', () => {
  assert.match(schemaSource, /output\s+AgentOutputType\[\]/)
  assert.match(schemaSource, /defaultOutput\s+AgentOutputType\[\]/)
  assert.match(dtoSource, /output: OutputType\[\]/)
  assert.match(templatesDtoSource, /defaultOutput: OutputType\[\]/)
  // The store's own Agent/AgentTemplate shapes must agree with their DTOs.
  assert.match(storeSource, /output: OutputType\[\]/)
  assert.match(storeSource, /defaultOutput: OutputType\[\]/)
})

test('the migration rebuilds the enum, drops email, and moves both columns to arrays', () => {
  assert.match(migrationSource, /CREATE TYPE "AgentOutputType_new" AS ENUM \('message', 'note', 'calendar'\)/)
  assert.match(migrationSource, /ALTER COLUMN "output" TYPE "AgentOutputType_new"\[\]/)
  assert.match(migrationSource, /ALTER COLUMN "defaultOutput" TYPE "AgentOutputType_new"\[\]/)
  // Existing email agents keep a delivery surface: email resolved to the inbox.
  assert.match(migrationSource, /WHEN "output"::text = 'email' THEN ARRAY\['message'::"AgentOutputType_new"\]/)
})

test('an empty destination set is rejected rather than silently storing nothing', () => {
  assert.match(controllerSource, /outputSchema = z\.array\([\s\S]{0,90}?\)\.min\(1\)\.max\(3\)/)
  assert.match(serviceSource, /patch\.output\.length === 0/)
  // Creation defaults to the inbox instead of failing a template-less agent.
  assert.match(serviceSource, /if \(output\.length === 0\) output = \['message'\]/)
})

test('the picker is multi-select and refuses to empty the selection', () => {
  assert.match(pickerSource, /role="checkbox"/)
  assert.match(pickerSource, /aria-checked=\{isSelected\}/)
  assert.doesNotMatch(pickerSource, /email/)
  // Deselecting the last remaining destination is a no-op.
  assert.match(pickerSource, /if \(next\.length === 0\) return/)
})

test('the picker offers exactly the three supported destinations', () => {
  assert.match(catalogueSource, /type: 'message',[\s\S]*?type: 'note',[\s\S]*?type: 'calendar',/)
  assert.doesNotMatch(catalogueSource, /'email'/)
  // Each one states where output lands, so the choice is not a guess.
  assert.match(catalogueSource, /blurb: 'A message on the Agents inbox'/)
  assert.match(catalogueSource, /blurb: 'A card on the Notes board'/)
})

test('the toast names the surfaces that actually took the output', () => {
  // Derived from the written rows, not from the agent's configuration, so the
  // calendar fallback is reported as a note.
  assert.match(agentsPageSource, /describeWrittenDestinations\(result\.output\)/)
  assert.doesNotMatch(agentsPageSource, /destination === 'diary'/)
  assert.doesNotMatch(agentsPageSource, /result\.message/)
})

test('the run result carries destinations and rows across the API', () => {
  assert.match(dtoSource, /destinations\?: OutputDestination\[\]/)
  assert.match(dtoSource, /output\?: RunOutputRecord\[\]/)
  assert.doesNotMatch(dtoSource, /message\?: \{ id: string; title: string; body: string \}/)
  assert.match(storeSource, /destinations: result\.destinations \?\? \[\]/)
  assert.match(storeSource, /output: written,/)
})

test('only the surfaces a run touched are refreshed', () => {
  // Refreshing everything would clobber unrelated optimistic state.
  assert.match(storeSource, /touched\('inbox'\)/)
  assert.match(storeSource, /touched\('notes'\)/)
  assert.match(storeSource, /touched\('calendar'\)/)
  assert.doesNotMatch(storeSource, /useDiaryStore/)
})

test('the run and run-list DTOs remain distinct shapes', () => {
  // RunResultDto.output is a list of records; AgentRunDto.message is a snapshot
  // string. Collapsing them is what let the old toast treat a written row as an
  // inbox message in the first place.
  const runResult = dtoSource.split('export type RunResultDto')[1]?.split('\n}')[0] ?? ''
  const runList = dtoSource.split('export type AgentRunDto')[1]?.split('\n}')[0] ?? ''

  assert.ok(runResult.length > 0, 'RunResultDto must exist')
  assert.ok(runList.length > 0, 'AgentRunDto must exist for the run-history endpoint')

  assert.match(runList, /message\?:\s*string/)
  assert.match(runList, /startedAt:\s*string/)
  assert.doesNotMatch(runList, /destinations/)
  assert.doesNotMatch(runList, /RunOutputRecord/)
})

test('a calendar destination tells the model the date is what places the entry', () => {
  // The calendar write depends entirely on an [EVENT] line carrying a date, so
  // the prompt has to make that dependency explicit.
  assert.match(promptsSource, /agent\.output\.includes\('calendar'\)/)
  assert.match(promptsSource, /\[EVENT\] line carrying that date/)
})
