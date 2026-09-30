/**
 * Where a finished agent run's output was written.
 *
 * - `inbox` — an `AgentMessage`, shown on the Agents inbox tab
 * - `diary` — a `DiaryEntry`, shown in the diary
 * - `none`  — nothing was written; the output type is unknown or unset
 */
export type OutputDestination = 'inbox' | 'diary' | 'none'

/**
 * Resolve the surface an agent's output belongs on.
 *
 * The runner uses this so the response can name the real destination instead of
 * leaving callers to guess from the presence of a message object.
 *
 * @param outputType - The agent's `output` column, e.g. `message`, `email`, `note`
 * @returns The destination the run's output should be reported as
 */
export function resolveOutputDestination(outputType: string): OutputDestination {
  const normalized = outputType.trim().toLowerCase()
  if (normalized === 'message' || normalized === 'email') return 'inbox'
  if (normalized === 'note') return 'diary'
  return 'none'
}