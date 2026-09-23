import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { listRuns, type RunResultDto } from '../../global/repositories/agents.repository'

type RunHistoryProps = {
  agentId: string
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-red-500/15 text-red-400',
  running: 'bg-blue-500/15 text-blue-400',
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  failed: XCircle,
  running: Loader2,
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

export function RunHistory({ agentId }: RunHistoryProps) {
  const [runs, setRuns] = useState<RunResultDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listRuns(agentId)
      .then((data) => { if (!cancelled) { setRuns(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Failed to load run history'); setLoading(false) } })
    return () => { cancelled = true }
  }, [agentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-(--text-muted)">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Loading run history...
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-center text-sm text-(--text-muted)">{error}</p>
  }

  if (runs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-(--text-muted)">
        No runs yet. Click &quot;Run&quot; to get started.
      </p>
    )
  }

  const visible = showAll ? runs : runs.slice(0, 5)

  return (
    <div className="flex flex-col gap-2">
      {visible.map((run) => {
        const isExpanded = expandedId === run.runId
        const StatusIcon = STATUS_ICONS[run.status] ?? CheckCircle2

        return (
          <div key={run.runId} className="rounded-xl border border-(--border) bg-(--surface)">
            <button
              onClick={() => setExpandedId(isExpanded ? null : run.runId)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-(--surface-2)"
            >
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[run.status] ?? ''}`}>
                <StatusIcon size={12} className={run.status === 'running' ? 'animate-spin' : ''} />
                {run.status}
              </span>

              <div className="min-w-0 flex-1 text-[11px] text-(--text-muted)">
                <span>{formatDuration(run.durationMs)}</span>
                <span className="mx-1.5">&middot;</span>
                <span>{run.tokensUsed.toLocaleString()} tokens</span>
              </div>

              {run.message ? (
                <p className="min-w-0 max-w-[200px] truncate text-[11px] text-(--text-muted)">{run.message}</p>
              ) : null}

              {isExpanded ? <ChevronUp size={14} className="text-(--text-muted)" /> : <ChevronDown size={14} className="text-(--text-muted)" />}
            </button>

            {isExpanded ? (
              <div className="border-t border-(--border) px-4 py-3 space-y-3">
                {run.message ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-(--text-muted)">Message</p>
                    <pre className="overflow-x-auto rounded-lg bg-(--surface-2) p-3 text-xs text-(--text-muted) whitespace-pre-wrap">
                      {run.message}
                    </pre>
                  </div>
                ) : null}

                {run.sideEffects && run.sideEffects.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-(--text-muted)">Side effects</p>
                    <ul className="list-inside list-disc rounded-lg bg-(--surface-2) p-3 text-xs text-(--text-muted)">
                      {run.sideEffects.map((eff, i) => (
                        <li key={i}>{eff}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {run.error ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-red-400">Error</p>
                    <pre className="overflow-x-auto rounded-lg bg-red-500/10 p-3 text-xs text-red-400 whitespace-pre-wrap">
                      {run.error}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}

      {runs.length > 5 && !showAll ? (
        <button
          onClick={() => setShowAll(true)}
          className="text-center text-xs font-medium text-(--accent) transition hover:underline"
        >
          Show all {runs.length} runs
        </button>
      ) : null}
    </div>
  )
}
