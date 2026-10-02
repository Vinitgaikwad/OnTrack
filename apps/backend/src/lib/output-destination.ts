/**
 * Where a finished agent run's output was written.
 *
 * - `inbox`    — an `AgentMessage`, shown on the Agents inbox tab
 * - `notes`    — a `Task` row, shown on the Notes board
 * - `calendar` — an `Appointment`, shown on the Calendar tab
 *
 * A run can target several at once, so this is resolved as a *set*: an agent
 * configured for `message` + `calendar` writes both surfaces in one run.
 *
 * The same set also gates what a run is allowed to *propose*. The marker contract
 * appended to every system prompt asks the model for `[TASK]`/`[EVENT]`/`[NOTE]`
 * lines regardless of `output`, so without that gate an inbox-only agent was sent
 * to an approval modal offering to add things to surfaces it was never given.
 */
import type { PendingActionKind } from './agent-prompts'

/** One of the surfaces a run's output can land on. */
export type OutputDestination = 'inbox' | 'notes' | 'calendar'

/** The `Agent.output` / `AgentTemplate.defaultOutput` column values. */
export type OutputType = 'message' | 'note' | 'calendar'

/**
 * Write order for a run's destinations.
 *
 * Fixed so a multi-destination run always reports its surfaces in the same
 * order, whatever order the agent's stored array happens to be in. `notes` comes
 * before `calendar` so the calendar fallback (see `agent.runner.ts`) can detect
 * that a note already exists rather than writing a second one.
 */
export const OUTPUT_DESTINATION_ORDER: readonly OutputDestination[] = ['inbox', 'notes', 'calendar']

const DESTINATION_BY_OUTPUT_TYPE: Record<OutputType, OutputDestination> = {
  message: 'inbox',
  note: 'notes',
  calendar: 'calendar',
}

/**
 * Resolve the surface a single output type belongs on.
 *
 * @param outputType - One `Agent.output` column value, e.g. `message`
 * @returns The destination, or null when the type is unknown or unset
 */
export function resolveOutputDestination(outputType: string): OutputDestination | null {
  const normalized = outputType.trim().toLowerCase()
  return DESTINATION_BY_OUTPUT_TYPE[normalized as OutputType] ?? null
}

/**
 * Resolve every surface a run should write to.
 *
 * Unknown and duplicated entries are dropped, and the result is ordered by
 * {@link OUTPUT_DESTINATION_ORDER}. An agent with no valid destination resolves
 * to an empty set — the caller writes nothing rather than guessing a surface.
 *
 * @param outputTypes - The agent's full `output` column
 * @returns Deduplicated destinations in write order, possibly empty
 */
export function resolveOutputDestinations(outputTypes: readonly string[]): OutputDestination[] {
  const wanted = new Set<OutputDestination>()
  for (const outputType of outputTypes) {
    const destination = resolveOutputDestination(outputType)
    if (destination) wanted.add(destination)
  }
  return OUTPUT_DESTINATION_ORDER.filter((destination) => wanted.has(destination))
}

/**
 * The surface approving a proposal of each kind would actually write to.
 *
 * `task` and `event` both become `Appointment` rows — the Calendar page's "Task"
 * action and an entry respectively — so both gate on `calendar`.
 *
 * `note` is the exception: `createActionItems` writes it as a `DiaryEntry`, and
 * Diary is not a selectable destination. It gates on `notes` as a *policy* rather
 * than a routing claim: choosing the Notes destination is how a user says this
 * agent may propose things onto their boards at all. A kind missing here is
 * dropped rather than offered, so a new marker kind can never reach a surface
 * nobody chose.
 */
const DESTINATION_BY_ACTION_KIND: Record<PendingActionKind, OutputDestination> = {
  task: 'calendar',
  event: 'calendar',
  note: 'notes',
}

/**
 * Keep only the proposals whose surface the agent actually delivers to.
 *
 * This is the approval flow's counterpart to {@link resolveOutputDestinations}:
 * destinations decide where a run *writes*, and this decides what it may *ask*
 * to add. Without it the two disagree, and selecting Inbox still produced an
 * "Approve agent additions" modal full of notes and tasks.
 *
 * @param actions - Parsed marker lines, in the order the model emitted them
 * @param outputTypes - The agent's `output` column
 * @returns The proposals the agent is configured to service, order preserved
 */
export function filterPendingActionsByDestination<T extends { kind: PendingActionKind }>(
  actions: readonly T[],
  outputTypes: readonly string[]
): T[] {
  const destinations = new Set(resolveOutputDestinations(outputTypes))
  return actions.filter((action) => {
    const destination = DESTINATION_BY_ACTION_KIND[action.kind]
    return destination !== undefined && destinations.has(destination)
  })
}
