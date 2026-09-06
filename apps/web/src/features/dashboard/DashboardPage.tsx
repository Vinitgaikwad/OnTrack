import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Eye, EyeOff, LayoutDashboard, Pin, Sparkles, X } from 'lucide-react'
import { useDashboardStore } from '../../global/stores/useDashboardStore'
import { WIDGET_DEFS } from './widgets'
import { Button } from '../../global/ui/Button'
import { Card } from '../../global/ui/Card'

type DashboardPageProps = {
  isWidget?: boolean
  onClose?: () => void
  onOpenApp?: () => void
}

export function DashboardPage({ isWidget = false, onClose, onOpenApp }: DashboardPageProps) {
  const widgets = useDashboardStore((state) => state.widgets)
  const hideWidget = useDashboardStore((state) => state.hideWidget)
  const showWidget = useDashboardStore((state) => state.showWidget)

  const enabled = useMemo(() => WIDGET_DEFS.filter((def) => widgets.includes(def.id)), [widgets])

  const [dashboardVisible, setDashboardVisible] = useState(true)
  const [isOnTop, setIsOnTop] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.ontrack
      ?.isDashboardVisible()
      .then((visible) => {
        if (!cancelled) setDashboardVisible(visible)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  const hasDesktopBridge = typeof window.ontrack?.isDashboardVisible === 'function'

  const toggleDashboard = async () => {
    if (!window.ontrack) return
    const visible = await window.ontrack.isDashboardVisible().catch(() => dashboardVisible)
    if (visible) window.ontrack.closeDashboard()
    else window.ontrack.showDashboard()
    setDashboardVisible(!visible)
  }

  const toggleOnTop = () => {
    if (!window.ontrack) return
    const next = !isOnTop
    window.ontrack.setDashboardAlwaysOnTop(next)
    setIsOnTop(next)
  }

  if (isWidget) {
    return (
      <div className="min-h-screen">
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

        {enabled.length > 0 ? (
          <div className="grid gap-2">
            {enabled.map((def) => {
              const Widget = def.component
              return <Widget key={def.id} compact />
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-(--border-strong) p-6 text-center">
            <p className="text-sm text-(--text-muted)">No wedges yet.</p>
            <Button size="sm" variant="soft" className="mt-3" onClick={onOpenApp}>
              <ExternalLink size={14} />
              Open OnTrack to add wedges
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard size={22} className="text-(--accent)" />
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-(--text-muted)">
          Choose which wedges appear in the pinned top-left window. Each one mirrors its tab&apos;s
          real data.
        </p>
      </header>

      <Card className="p-2">
        <ul className="divide-y divide-(--border)">
          {WIDGET_DEFS.map((def) => {
            const Icon = def.icon
            const on = widgets.includes(def.id)
            return (
              <li key={def.id}>
                <button
                  role="switch"
                  aria-checked={on}
                  onClick={() => (on ? hideWidget(def.id) : showWidget(def.id))}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-(--surface-2)"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-(--accent-soft) text-(--accent)">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{def.label}</span>
                    <span className="block truncate text-xs text-(--text-muted)">
                      {def.description}
                    </span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                      on ? 'bg-(--accent)' : 'bg-(--border-strong)'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        on ? 'translate-x-4' : ''
                      }`}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Window preview</h2>
          <Button
            size="sm"
            variant={hasDesktopBridge ? (dashboardVisible ? 'soft' : 'primary') : 'ghost'}
            onClick={toggleDashboard}
            disabled={!hasDesktopBridge}
            title={
              hasDesktopBridge
                ? dashboardVisible
                  ? 'Hide the pinned dashboard'
                  : 'Bring the pinned dashboard back'
                : 'Only available in the desktop app'
            }
          >
            {dashboardVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            {dashboardVisible ? 'Hide window' : 'Show window'}
          </Button>
        </div>
        {enabled.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {enabled.map((def) => {
              const Widget = def.component
              return <Widget key={def.id} compact />
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-(--border-strong) p-8 text-center text-sm text-(--text-muted)">
            Turn on a wedge above to see it here.
          </p>
        )}
      </div>
    </div>
  )
}