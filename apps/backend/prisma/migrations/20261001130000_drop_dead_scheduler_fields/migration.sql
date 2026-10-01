-- Drop the Agent scheduling columns and the AgentTriggerType enum.
--
-- These described a scheduler that was never built. triggerType was pinned to
-- 'manual' on every agent and read by nothing; schedule, timezone and nextRunAt
-- were never read or written by any code outside the generated Prisma client.
-- Keeping them meant the schema kept advertising a capability the system does
-- not have, and a later reader could reasonably assume cron wiring existed.
--
-- If scheduling is ever built, these columns come back with the handler and
-- tests that need them, at which point their shape will be informed by the real
-- requirements rather than guessed now.
--
-- Note: `migrate diff` also reports `ALTER COLUMN "updatedAt" DROP DEFAULT` for
-- this table. That is pre-existing drift between the database and schema.prisma
-- (reproducible on an untouched checkout) and is deliberately not included here.

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "nextRunAt",
DROP COLUMN "schedule",
DROP COLUMN "timezone",
DROP COLUMN "triggerType";

-- DropEnum
DROP TYPE "AgentTriggerType";