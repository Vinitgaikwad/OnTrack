import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const schemaSource = await readFile('apps/backend/prisma/schema.prisma', 'utf8')
const dtoSource = await readFile('apps/web/src/global/repositories/agents.repository.ts', 'utf8')
const storeSource = await readFile('apps/web/src/global/stores/useAgentsStore.ts', 'utf8')
const migrationSource = await readFile(
  'apps/backend/prisma/migrations/20261001130000_drop_dead_scheduler_fields/migration.sql',
  'utf8'
)

/** Body of the `Agent` model in schema.prisma, so AgentTool assertions cannot match it. */
const agentModel = schemaSource.match(/model Agent \{[\s\S]*?\n\}/)?.[0] ?? ''

/** The `AgentDto` type body. */
const agentDto = dtoSource.match(/export type AgentDto = \{[\s\S]*?\n\}/)?.[0] ?? ''

/** The `Agent` type body in the store. */
const storeAgent = storeSource.match(/export type Agent = \{[\s\S]*?\n\}/)?.[0] ?? ''

/** `CreateAgentInput` body. */
const createInput = dtoSource.match(/export type CreateAgentInput = \{[\s\S]*?\n\}/)?.[0] ?? ''

test('the unused scheduling columns are gone from Agent', () => {
  // Every agent was created with triggerType: 'manual' and no code has ever read
  // any of these, so they could only ever describe a scheduler that was never
  // built. `schedule` and `timezone` are also read by nothing outside the model.
  assert.doesNotMatch(agentModel, /^\s*triggerType\b/m)
  assert.doesNotMatch(agentModel, /^\s*schedule\b/m)
  assert.doesNotMatch(agentModel, /^\s*timezone\b/m)
  assert.doesNotMatch(agentModel, /^\s*nextRunAt\b/m)
})

test('the AgentTriggerType enum is gone, not left dangling', () => {
  // Only triggerType referenced it. Leaving the type behind would put an enum in
  // Postgres that no column can ever hold a value of.
  assert.doesNotMatch(schemaSource, /enum AgentTriggerType/)
})

test('the DTO and store no longer carry a trigger type', () => {
  assert.doesNotMatch(agentDto, /triggerType/)
  assert.doesNotMatch(storeAgent, /triggerType/)
  assert.doesNotMatch(createInput, /triggerType/)
})

test('nothing maps a hardcoded manual trigger any more', () => {
  // The store pinned every new agent to 'manual'. With the field gone there is
  // nothing to pin, and no code should pretend otherwise.
  assert.doesNotMatch(storeSource, /triggerType: dto\.triggerType/)
  assert.doesNotMatch(storeSource, /triggerType: 'manual'/)
})

test('the migration drops the columns and the enum together', () => {
  assert.match(migrationSource, /ALTER TABLE "Agent"[\s\S]*?DROP COLUMN "triggerType"/)
  assert.match(migrationSource, /ALTER TABLE "Agent"[\s\S]*?DROP COLUMN "schedule"/)
  assert.match(migrationSource, /ALTER TABLE "Agent"[\s\S]*?DROP COLUMN "timezone"/)
  assert.match(migrationSource, /ALTER TABLE "Agent"[\s\S]*?DROP COLUMN "nextRunAt"/)
  assert.match(migrationSource, /DROP TYPE "AgentTriggerType"/)
})

test('the output destinations survive — this cleanup is not about output', () => {
  // Guards against an over-broad edit taking the enum that actually has a job.
  assert.match(schemaSource, /enum AgentOutputType/)
  assert.match(agentModel, /output\s+AgentOutputType\[\]/)
})