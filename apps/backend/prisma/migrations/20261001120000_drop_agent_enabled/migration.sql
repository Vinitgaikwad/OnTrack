-- Drop Agent.enabled.
--
-- The flag was UI-only. Its one behavioural use was rejecting a manual run with
-- "Agent is disabled", which told the user they had paused an agent that could
-- never run on its own: there is no cron trigger and no scheduler, so "Disabled"
-- meant nothing more than "the Run button is unavailable". Agent.triggerType /
-- schedule / timezone stay for the future scheduler; AgentTool.enabled is a
-- different column and is untouched, since the runner filters tool rows on it.
--
-- All 3 existing rows are enabled=true, so no agent loses the ability to run:
-- after this drop, every agent is simply always runnable.

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "enabled";