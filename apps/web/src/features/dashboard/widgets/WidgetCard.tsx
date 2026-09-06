import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type WidgetCardProps = {
  title: string
  icon: ReactNode
  onRemove?: () => void
  right?: ReactNode
  compact?: boolean
  children: ReactNode
}

export function WidgetCard({
  title,
  icon,
  onRemove,
  right,
  compact = false,
  children,
}: WidgetCardProps) {
  return (
    <section
      className={`rounded-xl border border-(--border) bg-(--surface) shadow-sm ${
        compact ? 'p-2.5' : 'p-4'
      }`}
    >
      <header className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <span
          className={`grid place-items-center rounded-lg bg-(--accent-soft) text-(--accent) ${
            compact ? 'h-6 w-6' : 'h-7 w-7'
          }`}
        >
          {icon}
        </span>
        <h3 className={`font-semibold ${compact ? 'text-[13px]' : 'text-sm'}`}>{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          {right ? <span className="shrink-0">{right}</span> : null}
          {onRemove ? (
            <button
              onClick={onRemove}
              aria-label={`Remove ${title} wedge`}
              className="grid h-6 w-6 place-items-center rounded-md text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  )
}