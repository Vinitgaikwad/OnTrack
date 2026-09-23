import { Bot, Play } from 'lucide-react'
import type { Agent } from '../../global/stores/useAgentsStore'
import { AGENT_ICONS, type AgentIconKey } from './AgentsPage'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import { useAgentMessagesStore } from '../../global/stores/useAgentMessagesStore'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'

type AgentWidgetProps = {
  agent: Agent
}

function timeAgo(date: string | null | undefined): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentWidget({ agent }: AgentWidgetProps) {
  const runAgent = useAgentsStore((state) => state.runAgent)
  const runningAgentId = useAgentsStore((state) => state.runningAgentId)
  const messages = useAgentMessagesStore((state) => state.messages)

  const Icon = AGENT_ICONS[agent.icon as AgentIconKey] ?? Bot
  const isRunning = runningAgentId === agent.id
  const isAnotherRunning = runningAgentId !== null && !isRunning

  const unreadCount = messages.filter((m) => m.agentId === agent.id && !m.read).length

  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{
          backgroundColor: 'color-mix(in srgb, ' + agent.color + ' 18%, transparent)',
          color: agent.color,
        }}
      >
        <Icon size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{agent.name}</p>
        <p className="text-[11px] text-(--text-muted)">{timeAgo(agent.lastRunAt)}</p>
      </div>

      {unreadCount > 0 ? (
        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-(--accent) px-1.5 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      ) : null}

      <Button
        size="sm"
        variant="soft"
        disabled={isAnotherRunning}
        onClick={() => runAgent(agent.id)}
        className="!px-2 !py-1"
      >
        <Play size={12} className={isRunning ? 'animate-pulse' : ''} />
      </Button>
    </Card>
  )
}
