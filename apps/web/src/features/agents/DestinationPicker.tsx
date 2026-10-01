import type { OutputType } from '../../global/repositories/agents.repository'
import { DESTINATIONS, type DestinationMeta } from './output-destinations'

type DestinationPickerProps = {
  selected: OutputType[]
  onChange: (next: OutputType[]) => void
}

/**
 * Multi-select control for an agent's output destinations.
 *
 * Buttons rather than checkboxes because the choice is about *where output
 * lands*, which reads as a place, not a setting — and because a checkbox grid
 * hides the fact that these are additive. At least one must stay selected:
 * deselecting the last one is a no-op, since an agent with no destination
 * silently discards every run.
 */
export function DestinationPicker({ selected, onChange }: DestinationPickerProps) {
  const toggle = (type: OutputType) => {
    if (selected.includes(type)) {
      const next = selected.filter((value) => value !== type)
      if (next.length === 0) return
      onChange(next)
      return
    }
    // Keep catalogue order so the selection reads the same way every time.
    onChange(DESTINATIONS.map((option) => option.type).filter((value) => selected.includes(value) || value === type))
  }

  const atMinimum = selected.length === 1

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-(--text)">Where should output go?</legend>
      <p className="mb-2.5 text-xs text-(--text-muted)">
        Pick one or more. Every run saves to each place you choose.
      </p>

      <div className="grid gap-2">
        {DESTINATIONS.map((meta) => (
          <DestinationOption
            key={meta.type}
            meta={meta}
            isSelected={selected.includes(meta.type)}
            isLastSelected={atMinimum && selected.includes(meta.type)}
            onToggle={() => toggle(meta.type)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function DestinationOption({
  meta,
  isSelected,
  isLastSelected,
  onToggle,
}: {
  meta: DestinationMeta
  isSelected: boolean
  isLastSelected: boolean
  onToggle: () => void
}) {
  const Icon = meta.icon

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      onClick={onToggle}
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        isSelected
          ? 'border-(--accent) bg-(--accent-soft)/40'
          : 'border-(--border) bg-(--surface) hover:bg-(--surface-2)'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
          isSelected ? 'border-(--accent) bg-(--accent) text-white' : 'border-(--border-strong)'
        }`}
      >
        {isSelected ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{
          backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
          color: meta.color,
        }}
      >
        <Icon size={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{meta.label}</span>
        <span className="block text-[11px] text-(--text-muted)">{meta.blurb}</span>
        {isLastSelected ? (
          <span className="mt-1 block text-[11px] text-(--text-muted)">
            Keep at least one — output needs somewhere to go.
          </span>
        ) : null}
      </span>
    </button>
  )
}
