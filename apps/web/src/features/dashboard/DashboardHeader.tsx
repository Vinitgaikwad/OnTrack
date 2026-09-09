import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Pin, Sparkles, X } from 'lucide-react'

type DashboardHeaderProps = {
  onOpenApp?: () => void
  onClose?: () => void
}

export function DashboardHeader({ onOpenApp, onClose }: DashboardHeaderProps) {
  const [isOnTop, setIsOnTop] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.ontrack
      ?.isDashboardAlwaysOnTop()
      .then((onTop) => {
        if (!cancelled) setIsOnTop(onTop)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggleOnTop = () => {
    if (!window.ontrack) return
    const next = !isOnTop
    window.ontrack.setDashboardAlwaysOnTop(next)
    setIsOnTop(next)
  }

  return (
    <header className="mb-2 flex select-none items-center gap-2 [-webkit-app-region:drag]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-(--accent) text-white">
        <Sparkles size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-bold tracking-tight">OnTrack</p>
        <p className="text-[11px] text-(--text-muted)">{format(new Date(), 'EEE, MMM d')}</p>
      </div>
      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        <button
          onClick={toggleOnTop}
          title={isOnTop ? 'Always on top (on)' : 'Always on top (off)'}
          aria-label={isOnTop ? 'Turn off always on top' : 'Turn on always on top'}
          aria-pressed={isOnTop}
          className={`grid h-7 w-7 place-items-center rounded-lg transition ${
            isOnTop
              ? 'bg-(--accent-soft) text-(--accent)'
              : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text)'
          }`}
        >
          <Pin size={14} className={isOnTop ? '' : 'rotate-45'} />
        </button>
        {onOpenApp ? (
          <button
            onClick={onOpenApp}
            title="Open OnTrack"
            aria-label="Open OnTrack"
            className="grid h-7 w-7 place-items-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
          >
            <ExternalLink size={14} />
          </button>
        ) : null}
        {onClose ? (
          <button
            onClick={onClose}
            title="Hide dashboard"
            aria-label="Hide dashboard"
            className="grid h-7 w-7 place-items-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
