import { Bot } from 'lucide-react'
import { useAgentsStore } from '../../../global/stores/useAgentsStore'
import { WidgetCard } from './WidgetCard'

type AgentsWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

export function AgentsWidget({ onRemove, compact = false }: AgentsWidgetProps) {
  const agents = useAgentsStore((state) => state.agents)
  const enabled = agents.filter((agent) => agent.enabled)

  return (
    <WidgetCard title="Agents" icon={<Bot size={15} />} onRemove={onRemove} compact={compact}>
      {enabled.length === 0 ? (
        <p className="text-sm text-(--text-muted)">No agents on duty. Create one.</p>
      ) : (
        <ul className="space-y-1">
          {enabled.slice(0, 3).map((agent) => (
            <li
              key={agent.id}
              className="flex items-center gap-2 rounded-lg bg-(--surface-2) px-2 py-1.5"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{agent.name}</span>
              <span className="shrink-0 text-[11px] text-(--text-muted)">{agent.role}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}