/**
 * Agent prompt construction and action-marker parsing.
 *
 * Dependency-free (no relative imports) so it can be unit tested under Node's
 * strip-only type stripping.
 */

export type PendingActionKind = 'task' | 'event' | 'note'

export type PendingAction = {
  kind: PendingActionKind
  title: string
  date?: string
  startTime?: string
  endTime?: string | null
  note?: string
}

export type AgentPromptInput = {
  name: string
  role: string
  description: string
  prompt?: string | null
  sources: string[]
  output: string
  preferences: string[]
}

/**
 * Appended last, after the user's own instructions, so it stays in effect.
 * The seeded agents documented these markers in their descriptions, but a live
 * run ignored them and wrote prose dates instead, producing zero actions.
 */
const MACHINE_FORMAT_CONTRACT = [
  '',
  '--- MACHINE OUTPUT CONTRACT (required) ---',
  'Start with a short markdown digest for the human reader.',
  'Then, only for concrete follow-up items, add lines in EXACTLY this shape:',
  '[TASK] <short imperative title> | <YYYY-MM-DD>',
  '[EVENT] <short title> | <YYYY-MM-DD> | <HH:MM-HH:MM>',
  '[NOTE] <short title> | <detail>',
  '',
  'Rules for those lines:',
  '- The date must be its own pipe-delimited field, never written inside the title.',
  '- Use YYYY-MM-DD. Omit a marker line entirely if you cannot supply its fields.',
  '- Never wrap a marker line in backticks, bold, or a code fence.',
  '- Do not number the marker lines and do not restate these instructions.',
  '--- END CONTRACT ---',
].join('\n')

export function buildSystemPrompt(agent: AgentPromptInput): string {
  const parts: string[] = []
  parts.push(`You are "${agent.name}", an AI agent specializing in ${agent.role}.`)

  // The editable markdown document is the agent's real instructions. It used to
  // be dropped entirely, so every run ignored whatever the user had written.
  const doc = agent.prompt?.trim()
  if (doc) parts.push(`\n${doc}`)

  const instructions = agent.description.trim()
  if (instructions && instructions !== doc) parts.push(`\nInstructions:\n${instructions}`)

  if (agent.sources.length > 0) parts.push(`\nData sources: ${agent.sources.join(', ')}`)
  if (agent.preferences.length > 0) parts.push(`\nPreferences: ${agent.preferences.join(', ')}`)
  parts.push(`\nOutput format: ${agent.output}.`)
  parts.push(`\nBe concise, actionable, and structured. When listing items, use bullet points.`)
  parts.push(MACHINE_FORMAT_CONTRACT)
  return parts.join('')
}

export function buildUserPrompt(
  agent: { name: string; role: string },
  contextData: { news?: unknown[]; emails?: unknown[] }
): string {
  const parts: string[] = []
  parts.push(`Run the agent "${agent.name}" (${agent.role}).`)

  if (contextData.news && contextData.news.length > 0) {
    parts.push(`\n--- News data ---`)
    for (const item of contextData.news.slice(0, 20)) {
      const asRecord = item as Record<string, unknown>
      parts.push(`- [${String(asRecord.source || '')}] ${String(asRecord.title || '')}`)
    }
  }

  if (contextData.emails && contextData.emails.length > 0) {
    parts.push(`\n--- Recent emails ---`)
    for (const item of contextData.emails.slice(0, 15)) {
      const asRecord = item as Record<string, unknown>
      parts.push(
        `- From: ${String(asRecord.from || '')} | Subject: ${String(asRecord.subject || '')} | ${String(asRecord.snippet || '')}`
      )
    }
  } else {
    parts.push(
      `\n--- Recent emails ---\n(none available — say so plainly instead of inventing emails)`
    )
  }

  return parts.join('')
}

// --- action marker parsing ---

const MARKER_KINDS = 'TASK|EVENT|NOTE|INFO'

/**
 * Normalises a line so decorated markers still parse.
 * Models routinely emit "- `[TASK]` Do the thing | 2026-09-28" or
 * "**[TASK]** Do the thing | 2026-09-28", neither of which the old
 * start-anchored regexes matched — so proposed actions were silently dropped.
 */
export function normalizeMarkerLine(rawLine: string): string {
  return rawLine
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '')
    .replace(/`/g, '')
    .replace(/^\s*(\*+|_+)\s*/, '')
    .replace(/\]\s*(\*+|_+)/, ']')
    // Collapse `[ TASK ]` to `[TASK]` so the matchers stay simple.
    .replace(/\[\s*([A-Za-z]+)\s*\]/, (_m, kind: string) => `[${kind.toUpperCase()}]`)
    .trim()
}

function hasMarker(line: string): boolean {
  return new RegExp(`^\\[(?:${MARKER_KINDS})\\]`).test(line)
}

const DATE_RE = /^\[TASK\]\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*[.!]?$/
const EVENT_RE =
  /^\[EVENT\]\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?\s*[.!]?$/
const NOTE_RE = /^\[NOTE\]\s*(.+?)\s*\|\s*(.+?)\s*[.!]?$/

// Models often ignore the pipe-delimited field and write the date inline, e.g.
// "1. `[TASK]` Pay invoice 4471 to Acme — overdue since 2026-09-20."
// Falling back to a date found anywhere in the line recovers those without
// inventing anything: no date in the line still yields no action.
const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/
const CLOCK = /\b(\d{1,2}:\d{2})\b/
const RANGE = /\b(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\b/i

/** Strips a trailing markdown code fence or emphasis left around a marker. */
function tidy(value: string): string {
  return value
    .replace(/`+\s*$/, '')
    .replace(/[*_]+$/, '')
    .trim()
}

/**
 * Removes date/time fragments and dangling punctuation from a fallback title.
 * Also drops a trailing clause that existed only to carry the date, e.g.
 * "Pay invoice to Acme — overdue since 2026-09-20." -> "Pay invoice to Acme".
 */
function cleanTitle(value: string): string {
  let out = value
  const stampAt = out.search(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/)
  if (stampAt > -1) {
    const before = out.slice(0, stampAt)
    const lastDash = Math.max(before.lastIndexOf('—'), before.lastIndexOf('–'))
    if (lastDash >= 2) out = before.slice(0, lastDash) + out.slice(stampAt)
  }
  return tidy(
    out
      .replace(RANGE, '')
      .replace(CLOCK, '')
      .replace(ISO_DATE, '')
      .replace(/\s*[—–-]\s*$/, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s*[.,;:]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

const pad2 = (n: string) => n.padStart(2, '0')

const normTime = (t: string) => `${pad2(t.split(':')[0]!)}:${t.split(':')[1]!}`

export function parseActionItems(text: string): PendingAction[] {
  const items: PendingAction[] = []

  for (const rawLine of text.split('\n')) {
    const line = normalizeMarkerLine(rawLine)
    if (!hasMarker(line)) continue

    const strictTask = DATE_RE.exec(line)
    if (strictTask) {
      items.push({ kind: 'task', title: tidy(strictTask[1]!), date: strictTask[2]! })
      continue
    }

    const strictEvent = EVENT_RE.exec(line)
    if (strictEvent) {
      items.push({
        kind: 'event',
        title: tidy(strictEvent[1]!),
        date: strictEvent[2]!,
        startTime: normTime(strictEvent[3]!),
        endTime: strictEvent[4] ? normTime(strictEvent[4]) : null,
      })
      continue
    }

    const strictNote = NOTE_RE.exec(line)
    if (strictNote) {
      items.push({ kind: 'note', title: tidy(strictNote[1]!), note: tidy(strictNote[2]!) })
      continue
    }

    // --- fallback: marker present, contract not followed ---

    if (line.startsWith('[NOTE]')) {
      const body = tidy(line.slice('[NOTE]'.length))
      if (!body) continue
      const pipeAt = body.indexOf('|')
      if (pipeAt > -1) {
        items.push({ kind: 'note', title: tidy(body.slice(0, pipeAt)), note: tidy(body.slice(pipeAt + 1)) })
        continue
      }
      // No pipe: fall back to the first em/en dash as the title separator.
      const dashAt = body.search(/[—–]/)
      if (dashAt > 0) {
        items.push({ kind: 'note', title: tidy(body.slice(0, dashAt)), note: tidy(body.slice(dashAt + 1)) })
        continue
      }
      items.push({ kind: 'note', title: body, note: '' })
      continue
    }

    if (line.startsWith('[TASK]')) {
      const body = tidy(line.slice('[TASK]'.length))
      const date = ISO_DATE.exec(body)?.[1]
      if (!date) continue
      const title = cleanTitle(body)
      if (!title) continue
      items.push({ kind: 'task', title, date })
      continue
    }

    if (line.startsWith('[EVENT]')) {
      const body = tidy(line.slice('[EVENT]'.length))
      const date = ISO_DATE.exec(body)?.[1]
      if (!date) continue
      const range = RANGE.exec(body)
      const clock = range?.[1] ?? CLOCK.exec(body)?.[1]
      const title = cleanTitle(body)
      if (!title) continue
      items.push({
        kind: 'event',
        title,
        date,
        startTime: clock ? normTime(clock) : '09:00',
        endTime: range?.[2] ? normTime(range[2]) : null,
      })
    }
  }

  return items
}

export function stripActionLines(text: string): string {
  return text
    .split('\n')
    .filter((rawLine) => {
      if (rawLine.trim().length === 0) return true
      return !hasMarker(normalizeMarkerLine(rawLine))
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
