-- Agent output became a SET of destinations instead of one, and the destination set
-- itself changed: 'email' is retired (it was only ever an alias for 'message' — both
-- wrote an AgentMessage to the inbox) and 'calendar' takes its place.
--
-- Postgres cannot drop a value from an enum, so the type is rebuilt and both dependent
-- columns are moved onto it in one pass. Casting an enum column to text[] first, then
-- back, is what keeps the old 'email' rows readable — a direct cast to the new array
-- type would fail on them.

-- CreateEnum
CREATE TYPE "AgentOutputType_new" AS ENUM ('message', 'note', 'calendar');

-- AlterTable
-- 'email' collapses into 'message' because both resolved to the inbox, so no agent
-- loses its delivery surface.
ALTER TABLE "Agent"
    ALTER COLUMN "output" DROP DEFAULT,
    ALTER COLUMN "output" TYPE "AgentOutputType_new"[] USING (
        CASE
            WHEN "output"::text = 'email' THEN ARRAY['message'::"AgentOutputType_new"]
            ELSE ARRAY["output"::text::"AgentOutputType_new"]
        END
    ),
    ALTER COLUMN "output" SET DEFAULT ARRAY['message']::"AgentOutputType_new"[];

-- AlterTable
ALTER TABLE "AgentTemplate"
    ALTER COLUMN "defaultOutput" DROP DEFAULT,
    ALTER COLUMN "defaultOutput" TYPE "AgentOutputType_new"[] USING (
        CASE
            WHEN "defaultOutput"::text = 'email' THEN ARRAY['message'::"AgentOutputType_new"]
            ELSE ARRAY["defaultOutput"::text::"AgentOutputType_new"]
        END
    ),
    ALTER COLUMN "defaultOutput" SET DEFAULT ARRAY['message']::"AgentOutputType_new"[];

-- DropEnum
DROP TYPE "AgentOutputType";

-- RenameEnum
ALTER TYPE "AgentOutputType_new" RENAME TO "AgentOutputType";
