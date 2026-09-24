import { useState } from 'react'
import { Bot, Loader2, Play } from 'lucide-react'
import { useAgentsStore } from '../../../global/stores/useAgentsStore'
import type { AgentActionItem } from '../../../global/repositories/agents.repository'
import { RunConfirmModal } from '../../agents/RunConfirmModal'
import { WidgetCard } from './WidgetCard'

type AgentsWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

export function AgentsWidget({ onRemove, compact = false }: AgentsWidgetProps) {
  const agents = useAgentsStore((state) => state.agents)
  const runAgent = useAgentsStore((state) => state.runAgent)
  const runningAgentId = useAgentsStore((state) => state.runningAgentId)
  const enabled = agents.filter((agent) => agent.enabled)

  const [pendingRun, setPendingRun] = useState<{ agentName: string; items: AgentActionItem[] } | null>(null)

  const handleRun = async (agentName: string, agentId: string) => {
    try {
      const result = await runAgent(agentId)
      if (result.pendingActions && result.pendingActions.length > 0) {
        setPendingRun({ agentName, items: result.pendingActions })
      }
    } catch {
      // store already surfaced the error via toast
    }
  }

  return (
    <WidgetCard title="Agents" icon={<Bot size={15} />} onRemove={onRemove} compact={compact}>
      {enabled.length === 0 ? (
        <p className="text-sm text-(--text-muted)">No agents on duty. Create one.</p>
      ) : (
        <ul className="space-y-1">
          {enabled.slice(0, 3).map((agent) => {
            const isRunning = runningAgentId === agent.id
            const isAnotherRunning = runningAgentId !== null && !isRunning
            return (
              <li
                key={agent.id}
                className="flex items-center gap-2 rounded-lg bg-(--surface-2) px-2 py-1.5"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{agent.name}</span>
                <button
                  onClick={() => handleRun(agent.name, agent.id)}
                  disabled={isAnotherRunning}
                  aria-label={`Run ${agent.name}`}
                  title={`Run ${agent.name}`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-(--text-muted) transition hover:bg-(--surface) hover:text-(--accent) disabled:opacity-40"
                >
                  {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <RunConfirmModal
        open={pendingRun !== null}
        agentName={pendingRun?.agentName ?? ''}
        items={pendingRun?.items ?? []}
        onCancel={() => setPendingRun(null)}
        onDone={() => setPendingRun(null)}
      />
    </WidgetCard>
  )
}