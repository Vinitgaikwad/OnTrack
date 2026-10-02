import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  OUTPUT_DESTINATION_ORDER,
  filterPendingActionsByDestination,
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
const seedSource = await readFile('apps/backend/src/services/seed.service.ts', 'utf8')
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
  assert.match(runnerSource, /const remaining = proposed\.filter\(\(action\) => !written\.consumed\.includes\(action\)\)/)
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

// --- proposed actions are gated on the same destinations ---

type Proposal = { kind: 'task' | 'event' | 'note'; title: string }

const TASK: Proposal = { kind: 'task', title: 'Reply to Ada' }
const EVENT: Proposal = { kind: 'event', title: 'Standup' }
const NOTE: Proposal = { kind: 'note', title: 'Invoice due' }

test('an inbox-only agent proposes nothing, so the approval modal never opens', () => {
  // The reported bug: the marker contract is appended to every system prompt, so
  // the model always emits [TASK]/[EVENT]/[NOTE] lines. Gating them on `output`
  // is the only thing that stops an Inbox-only agent being asked to approve
  // additions to surfaces it was never given.
  assert.deepEqual(filterPendingActionsByDestination([TASK, EVENT, NOTE], ['message']), [])
})

test('a proposal is kept only when the surface it writes to is selected', () => {
  // task and event both become Appointment rows; note becomes a DiaryEntry and is
  // gated on the Notes destination as the opt-in for proposing onto boards.
  assert.deepEqual(filterPendingActionsByDestination([TASK, EVENT], ['message', 'calendar']), [TASK, EVENT])
  assert.deepEqual(filterPendingActionsByDestination([EVENT], ['message', 'note']), [])
  assert.deepEqual(filterPendingActionsByDestination([TASK], ['message', 'note']), [])
  assert.deepEqual(filterPendingActionsByDestination([NOTE], ['message', 'note']), [NOTE])
  assert.deepEqual(filterPendingActionsByDestination([NOTE], ['message', 'calendar']), [])
})

test('a partly-selected agent keeps only the proposals it can service', () => {
  assert.deepEqual(filterPendingActionsByDestination([TASK, EVENT, NOTE], ['message', 'calendar']), [
    TASK,
    EVENT,
  ])
  assert.deepEqual(filterPendingActionsByDestination([TASK, EVENT, NOTE], ['note']), [NOTE])
})

test('the gate drops an unrecognised proposal kind instead of passing it through', () => {
  assert.deepEqual(
    filterPendingActionsByDestination([{ kind: 'info', title: 'FYI' }], ['message', 'note', 'calendar']),
    []
  )
})

test('the gate takes output types, not destination names', () => {
  // `notes` is a destination, not an `output` column value — accepting it would
  // let a malformed column silently gate on nothing.
  assert.deepEqual(filterPendingActionsByDestination([NOTE], ['message', 'notes']), [])
})

test('the gate keeps proposal order and does not mutate its input', () => {
  const input = [NOTE, TASK, EVENT]
  const filtered = filterPendingActionsByDestination(input, ['message', 'note'])
  assert.deepEqual(filtered, [NOTE])
  assert.deepEqual(input, [NOTE, TASK, EVENT])
})

test('the runner gates proposals before it hands them to the approval modal', () => {
  // Only dated events the calendar already wrote were filtered out, so every
  // other marker line reached the modal regardless of `output`.
  assert.match(runnerSource, /const proposed = filterPendingActionsByDestination\(pendingActions, agent\.output\)/)
  assert.match(runnerSource, /const remaining = proposed\.filter\(\(action\) => !written\.consumed\.includes\(action\)\)/)
})

test('refreshing a seeded agent never rewrites the destinations the user picked', () => {
  // `description` and `maxTokens` are prompt content the app owns and refreshes.
  // `output` is a user preference: refreshing it silently restored a destination
  // the user had just unchecked.
  const refreshBlock = seedSource.split('if (exists.draftOnly) {')[1]?.split('continue')[0] ?? ''
  assert.ok(refreshBlock.length > 0, 'the draftOnly refresh block must exist')
  assert.match(refreshBlock, /description: def\.description,/)
  assert.doesNotMatch(refreshBlock, /output:/)
})

test('the seeded Email Summarizer matches its own template destinations', () => {
  // The two disagreed: the email-summarizer template delivered `['message']`
  // while the seeded agent delivered `['message','calendar']`, so a new user's
  // email agent wrote a Note on every run that produced no dated event.
  // (job-tracker and news-provider still disagree — see DATAMODEL.md.)
  const templateOutput = seedSource.match(/slug: 'email-summarizer'[\s\S]*?defaultOutput: (\[[^\]]*\])/)?.[1]
  assert.ok(templateOutput, 'the email-summarizer template must declare defaultOutput')

  const seeded = seedSource.split('export const DEFAULT_AGENTS')[1] ?? ''
  const emailAgentOutput = seeded.match(/name: 'Email Summarizer'[\s\S]*?output: (\[[^\]]*\])/)?.[1]
  assert.ok(emailAgentOutput, 'the seeded Email Summarizer must declare output')

  assert.equal(
    emailAgentOutput.replace(/\s+/g, ''),
    templateOutput.replace(/\s+/g, ''),
    'the seeded Email Summarizer and its template must deliver to the same surfaces'
  )
})
