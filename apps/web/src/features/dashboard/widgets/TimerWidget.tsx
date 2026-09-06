import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useTimerStore } from '../../../global/stores/useTimerStore'
import { Button } from '../../../global/ui/Button'
import { WidgetCard } from './WidgetCard'

type TimerWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

export function TimerWidget({ onRemove, compact = false }: TimerWidgetProps) {
  const { status, minutes, remainingMs, endAt, presets, setMinutes, start, pause, resume, reset } =
    useTimerStore()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  const remaining = status === 'running' && endAt ? Math.max(0, endAt - now) : remainingMs
  const mm = pad(Math.floor(remaining / 60000))
  const ss = pad(Math.floor((remaining % 60000) / 1000))
  const isRunning = status === 'running'
  const isPaused = status === 'paused'

  return (
    <WidgetCard title="Timer" icon={<Timer size={15} />} onRemove={onRemove} compact={compact}>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => {
          const active = preset === minutes
          return (
            <button
              key={preset}
              onClick={() => setMinutes(preset)}
              title={active ? 'Current session length' : `Set a ${preset} minute session`}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                active
                  ? 'bg-(--accent-soft) text-(--accent)'
                  : 'bg-(--surface-2) text-(--text-muted) hover:text-(--text)'
              }`}
            >
              {preset} min
            </button>
          )
        })}
      </div>
      <p
        className={`mt-1 font-bold tabular-nums tracking-tight ${
          compact ? 'text-2xl' : 'text-3xl'
        } ${isRunning ? 'text-(--accent)' : ''}`}
      >
        {mm}:{ss}
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={isRunning ? pause : isPaused ? resume : start}>
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
          {isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw size={14} />
          Reset
        </Button>
      </div>
    </WidgetCard>
  )
}