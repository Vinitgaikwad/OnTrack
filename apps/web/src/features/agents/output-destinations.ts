/**
 * The places an agent's output can be delivered to, and how each one behaves.
 *
 * Kept outside the editor component so the picker, the agent cards, and the run
 * toast all describe a destination identically — they used to each hardcode their
 * own labels, which is how the editor ended up offering a `diary` destination
 * that no longer existed.
 */
import { CalendarDays, Inbox, NotebookPen } from 'lucide-react'
import type { OutputDestination, OutputType } from '../../global/repositories/agents.repository'

export type DestinationMeta = {
  /** Stored value on `Agent.output`. */
  type: OutputType
  /** Tab the output shows up on. */
  destination: OutputDestination
  label: string
  /** One line describing what actually happens, shown in the picker. */
  blurb: string
  icon: typeof Inbox
  color: string
}

/**
 * Ordered as a user reads the app left to right: Inbox, Notes, Calendar.
 *
 * `calendar` is last because it is conditional — it only creates an entry when
 * the output names a date, which the picker says out loud.
 */
export const DESTINATIONS: readonly DestinationMeta[] = [
  {
    type: 'message',
    destination: 'inbox',
    label: 'Inbox',
    blurb: 'A message on the Agents inbox',
    icon: Inbox,
    color: '#8e4ec6',
  },
  {
    type: 'note',
    destination: 'notes',
    label: 'Notes',
    blurb: 'A card on the Notes board',
    icon: NotebookPen,
    color: '#0ea5e9',
  },
  {
    type: 'calendar',
    destination: 'calendar',
    label: 'Calendar',
    blurb: 'An entry, dated from the output. No date means a note instead',
    icon: CalendarDays,
    color: '#f59e0b',
  },
]

const BY_TYPE = new Map(DESTINATIONS.map((meta) => [meta.type, meta]))

/** Look up a destination's metadata. Falls back to the inbox so the UI never renders undefined. */
export function getDestination(type: string): DestinationMeta {
  return BY_TYPE.get(type as OutputType) ?? DESTINATIONS[0]!
}

/**
 * One-line summary of where a run's output went.
 *
 * Names the real surfaces rather than echoing the configuration, because the
 * calendar destination can land on Notes instead when there is no date.
 *
 * @param records - Rows reported by the run result
 * @returns e.g. `Inbox and Calendar`, or an empty string when nothing was written
 */
export function describeWrittenDestinations(records: { destination: OutputDestination }[]): string {
  const labels: string[] = []
  for (const meta of DESTINATIONS) {
    if (records.some((record) => record.destination === meta.destination)) labels.push(meta.label)
  }
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}
