import { Info, TriangleAlert, X } from 'lucide-react'
import { useToastStore } from '../stores/useToastStore'

const ICONS = {
  info: Info,
  warn: TriangleAlert,
  error: TriangleAlert,
} as const

const COLORS = {
  info: 'var(--calendar)',
  warn: 'var(--notes)',
  error: 'var(--danger)',
} as const

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)
  const remove = useToastStore((state) => state.remove)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.level]
        const color = COLORS[toast.level]
        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-(--border) bg-(--surface) px-4 py-3 shadow-xl"
          >
            <Icon size={17} className="mt-0.5 shrink-0" style={{ color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-(--text)">{toast.title}</p>
              {toast.message ? (
                <p className="text-xs text-(--text-muted)">{toast.message}</p>
              ) : null}
            </div>
            <button
              onClick={() => remove(toast.id)}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}