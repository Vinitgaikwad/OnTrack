import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const schemaSource = await readFile('apps/backend/prisma/schema.prisma', 'utf8')
const runnerSource = await readFile('apps/backend/src/services/agent.runner.ts', 'utf8')
const dtoSource = await readFile('apps/web/src/global/repositories/agents.repository.ts', 'utf8')
const storeSource = await readFile('apps/web/src/global/stores/useAgentsStore.ts', 'utf8')
const agentsPageSource = await readFile('apps/web/src/features/agents/AgentsPage.tsx', 'utf8')
const widgetSource = await readFile('apps/web/src/features/dashboard/widgets/AgentsWidget.tsx', 'utf8')
const todaySource = await readFile('apps/web/src/features/today/TodayPage.tsx', 'utf8')

/** Body of the `Agent` model in schema.prisma, so AgentTool assertions cannot match it. */
const agentModel = schemaSource.match(/model Agent \{[\s\S]*?\n\}/)?.[0] ?? ''

/** The `AgentDto` type body, so AgentToolDto's own `enabled` is not matched by mistake. */
const agentDto = dtoSource.match(/export type AgentDto = \{[\s\S]*?\n\}/)?.[0] ?? ''

/** The `Agent` type body in the store, same reason. */
const storeAgent = storeSource.match(/export type Agent = \{[\s\S]*?\n\}/)?.[0] ?? ''

/** `CreateAgentInput` body: no `enabled` here is what makes a stray flag a type error. */
const createInput = dtoSource.match(/export type CreateAgentInput = \{[\s\S]*?\n\}/)?.[0] ?? ''

test('Agent.enabled is gone from the schema', () => {
  assert.doesNotMatch(agentModel, /^\s*enabled\b/m)
})

test('no surface reads or writes an agent-level enabled flag', () => {
  // The toggle implied an agent could run itself. Without a scheduler, "Disabled"
  // meant only "you cannot press Run", which is not what the label promised.
  assert.doesNotMatch(agentsPageSource, /agent\.enabled/)
  assert.doesNotMatch(widgetSource, /agent\.enabled/)
  // The dashboard widget and the Today panel both listed "agents on duty" by
  // filtering on this flag, so dropping the column without touching them would
  // have silently emptied both panels.
  assert.doesNotMatch(todaySource, /agent\.enabled/)
  // Absent from the create payload, so passing one is now a type error rather
  // than a silently ignored field.
  assert.doesNotMatch(createInput, /enabled/)
})

test('a run is no longer rejected because an agent is disabled', () => {
  assert.doesNotMatch(runnerSource, /Agent is disabled/)
  assert.doesNotMatch(runnerSource, /if \(!agent\.enabled\)/)
})

test('the agent DTO and store no longer carry an enabled flag', () => {
  assert.doesNotMatch(agentDto, /enabled/)
  assert.doesNotMatch(storeAgent, /enabled/)
})

test('AgentTool.enabled survives — it gates which tools actually fetch', () => {
  // A different field with a real job: the runner filters tool rows on it, so
  // removing it would silently disable every tool on every agent.
  assert.match(schemaSource, /model AgentTool \{[\s\S]*?enabled\s+Boolean/)
  assert.match(runnerSource, /where: \{ agentId, enabled: true \}/)
  assert.match(dtoSource, /AgentToolDto[\s\S]*?enabled: boolean/)
})