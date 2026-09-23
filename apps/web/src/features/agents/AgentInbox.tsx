import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import type { AgentMessage } from '../../global/stores/useAgentMessagesStore'
import { useAgentMessagesStore } from '../../global/stores/useAgentMessagesStore'
import { useAgentsStore } from '../../global/stores/useAgentsStore'
import Markdown from 'react-markdown'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'
import { IconButton } from '../../global/ui/IconButton'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentInbox() {
  const messages = useAgentMessagesStore((state) => state.messages)
  const hasMore = useAgentMessagesStore((state) => state.hasMore)
  const unreadCount = useAgentMessagesStore((state) => state.unreadCount)
  const loadStatus = useAgentMessagesStore((state) => state.loadStatus)
  const ensureLoaded = useAgentMessagesStore((state) => state.ensureLoaded)
  const loadMore = useAgentMessagesStore((state) => state.loadMore)
  const markRead = useAgentMessagesStore((state) => state.markRead)
  const deleteMessage = useAgentMessagesStore((state) => state.deleteMessage)

  const agents = useAgentsStore((state) => state.agents)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const getAgentName = (agentId: string): string => {
    const agent = agents.find((a) => a.id === agentId)
    return agent?.name ?? 'Agent'
  }

  const toggleExpand = (msg: AgentMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null)
    } else {
      setExpandedId(msg.id)
      if (!msg.read) {
        markRead(msg.id)
      }
    }
  }

  const isLoading = loadStatus === 'idle' || loadStatus === 'loading'

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-(--border) px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Inbox</h2>
          {unreadCount > 0 ? (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-(--accent) px-1.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 max-h-[600px] overflow-y-auto scroll-thin">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2 rounded-xl bg-(--surface-2) px-4 py-3">
                <div className="h-3 w-3/4 rounded bg-(--border)" />
                <div className="h-2 w-1/3 rounded bg-(--border)" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="grid place-items-center px-5 py-12 text-center">
            <p className="text-sm text-(--text-muted)">
              No messages yet. Run an agent to see results here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-(--border)">
            {messages.map((msg) => {
              const isExpanded = expandedId === msg.id
              return (
                <div key={msg.id} className={`transition ${!msg.read ? 'bg-(--accent-soft)/20' : ''}`}>
                  <button
                    onClick={() => toggleExpand(msg)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-(--surface-2)"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!msg.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-(--accent)" />
                        )}
                        <p className={`text-sm ${!msg.read ? 'font-semibold' : 'font-medium'}`}>
                          {msg.title}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-(--text-muted)">
                        <span>{getAgentName(msg.agentId)}</span>
                        <span>&middot;</span>
                        <span>{timeAgo(msg.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={Trash2}
                        label="Delete message"
                        onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}
                        className="!h-7 !w-7"
                      />
                      {isExpanded ? <ChevronUp size={16} className="text-(--text-muted)" /> : <ChevronDown size={16} className="text-(--text-muted)" />}
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-(--border) px-5 py-4">
                      <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-(--text-muted) [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5">
                        <Markdown>{msg.body}</Markdown>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center border-t border-(--border) p-3">
            <Button variant="ghost" size="sm" onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
