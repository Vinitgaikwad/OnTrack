import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystemPrompt,
  buildUserPrompt,
  normalizeMarkerLine,
  parseActionItems,
  stripActionLines,
} from '../apps/backend/src/lib/agent-prompts.ts'

const agent = {
  name: 'Email Summarizer',
  role: 'Email assistant',
  description: '## Mission\nSummarize emails.',
  prompt: null as string | null,
  sources: [] as string[],
  output: 'message',
  preferences: ['Keeps it short'] as string[],
}

// --- the regression: decorated markers were silently dropped ---

test('parses a bare marker line', () => {
  const items = parseActionItems('[TASK] Send invoice | 2026-09-28')
  assert.deepEqual(items, [{ kind: 'task', title: 'Send invoice', date: '2026-09-28' }])
})

test('parses a marker behind a markdown bullet', () => {
  const items = parseActionItems('- [TASK] Send invoice | 2026-09-28')
  assert.deepEqual(items, [{ kind: 'task', title: 'Send invoice', date: '2026-09-28' }])
})

test('parses a marker wrapped in backticks, as models actually emit', () => {
  const items = parseActionItems('- `[TASK]` Send invoice | 2026-09-28')
  assert.deepEqual(items, [{ kind: 'task', title: 'Send invoice', date: '2026-09-28' }])
})

test('parses a bold marker', () => {
  const items = parseActionItems('**[TASK]** Send invoice | 2026-09-28')
  assert.equal(items.length, 1)
  assert.equal(items[0]?.title, 'Send invoice')
})

test('parses a numbered-list marker', () => {
  const items = parseActionItems('1. [TASK] Send invoice | 2026-09-28')
  assert.equal(items.length, 1)
  assert.equal(items[0]?.title, 'Send invoice')
})

test('parses markers with a trailing code fence', () => {
  const items = parseActionItems('- `[TASK] Send invoice | 2026-09-28`')
  assert.equal(items.length, 1)
  assert.equal(items[0]?.title, 'Send invoice')
  assert.equal(items[0]?.date, '2026-09-28')
})

test('tolerates spaces inside the marker brackets', () => {
  assert.equal(parseActionItems('[ TASK ] Send invoice | 2026-09-28').length, 1)
})

test('parses events with and without an end time', () => {
  assert.deepEqual(parseActionItems('[EVENT] Standup | 2026-09-28 | 09:30'), [
    { kind: 'event', title: 'Standup', date: '2026-09-28', startTime: '09:30', endTime: null },
  ])
  assert.deepEqual(parseActionItems('[EVENT] Standup | 2026-09-28 | 09:30-10:00'), [
    { kind: 'event', title: 'Standup', date: '2026-09-28', startTime: '09:30', endTime: '10:00' },
  ])
})

test('pads single-digit event times so they match HH:MM storage', () => {
  const [ev] = parseActionItems('- `[EVENT]` Standup | 2026-09-28 | 9:05')
  assert.equal(ev?.startTime, '09:05')
})

test('parses notes behind a bullet', () => {
  assert.deepEqual(parseActionItems('- [NOTE] Watch this | renewal is annual'), [
    { kind: 'note', title: 'Watch this', note: 'renewal is annual' },
  ])
})

test('INFO lines are not proposed actions', () => {
  assert.deepEqual(parseActionItems('- `[INFO]` vague item, no date'), [])
})

test('a marker without a valid date is rejected rather than half-parsed', () => {
  assert.deepEqual(parseActionItems('- `[TASK]` items only for explicit requests'), [])
  assert.deepEqual(parseActionItems('- `[TASK]` Follow up | Nov 12, 2026'), [])
  assert.deepEqual(parseActionItems('- `[TASK]` Just a vague suggestion'), [])
})

test('recovers a task whose date was written inline instead of the pipe field', () => {
  // Verbatim from a live DeepSeek run against the real Email Summarizer prompt.
  const items = parseActionItems('1. `[TASK]` Pay invoice 4471 ($2,400) to Acme — overdue since 2026-09-20.')
  assert.deepEqual(items, [
    { kind: 'task', title: 'Pay invoice 4471 ($2,400) to Acme', date: '2026-09-20' },
  ])
})

test('recovers an event with a prose date and a single time', () => {
  const items = parseActionItems('2. `[EVENT]` Project sync — Friday 2026-09-29, 14:00 (confirm with Priya).')
  assert.equal(items.length, 1)
  const ev = items[0]
  assert.equal(ev?.kind, 'event')
  assert.equal(ev?.date, '2026-09-29')
  assert.equal(ev?.startTime, '14:00')
  assert.equal(ev?.endTime, null)
  assert.ok(!ev?.title?.includes('2026-09-29'), 'date leaked into the title')
  assert.ok(!ev?.title?.includes('14:00'), 'time leaked into the title')
})

test('recovers an event with an inline time range', () => {
  const ev = parseActionItems('[EVENT] Design review | 2026-09-29 | 14:00-15:00')[0]
  assert.equal(ev?.startTime, '14:00')
  assert.equal(ev?.endTime, '15:00')
})

test('recovers a note with no pipe separator', () => {
  assert.deepEqual(parseActionItems('- `[NOTE]` Renewal — Acme plan renews in December'), [
    { kind: 'note', title: 'Renewal', note: 'Acme plan renews in December' },
  ])
})

test('falls back to a 09:00 start only when an event has a date but no time', () => {
  const ev = parseActionItems('[EVENT] Offsite planning | due 2026-10-02')[0]
  assert.equal(ev?.date, '2026-10-02')
  assert.equal(ev?.startTime, '09:00')
})

test('INFO lines are still ignored by the fallback path', () => {
  assert.deepEqual(parseActionItems('4. `[INFO]` SaaS Daily weekly digest — no action required.'), [])
})

test('prose mentioning a marker mid-line is not an action', () => {
  assert.deepEqual(parseActionItems('Use the [TASK] marker like this | 2026-01-01'), [])
})

test('normalizeMarkerLine strips only leading decoration', () => {
  assert.equal(normalizeMarkerLine('- `[TASK]` a | b'), '[TASK] a | b')
  assert.equal(normalizeMarkerLine('  * plain text'), 'plain text')
  assert.equal(normalizeMarkerLine(''), '')
})

// --- multiple markers across a realistic reply ---

test('extracts every marker from a realistic reply and keeps the digest', () => {
  const reply = [
    '# Inbox digest',
    '',
    '- **Invoice overdue** — Acme sent the September invoice.',
    '- **Sync moved to Friday** — project team rescheduled.',
    '',
    '- `[TASK]` Reply to Acme about invoice | 2026-09-28',
    '- `[EVENT]` Project sync | 2026-09-29 | 14:00-15:00',
    '- `[NOTE]` Renewal | Acme plan renews in December',
  ].join('\n')

  const items = parseActionItems(reply)
  assert.equal(items.length, 3)
  assert.deepEqual(items.map((i) => i.kind), ['task', 'event', 'note'])

  const digest = stripActionLines(reply)
  assert.match(digest, /# Inbox digest/)
  assert.match(digest, /Invoice overdue/)
  assert.match(digest, /Sync moved to Friday/)
  assert.ok(!digest.includes('[TASK]'), 'task marker leaked into the digest')
  assert.ok(!digest.includes('[EVENT]'), 'event marker leaked into the digest')
  assert.ok(!digest.includes('[NOTE]'), 'note marker leaked into the digest')
  assert.ok(!digest.includes('```'), 'stray code fence left behind')
})

test('stripActionLines keeps an empty reply empty', () => {
  assert.equal(stripActionLines(''), '')
  assert.equal(stripActionLines('\n\n  \n'), '')
})

test('stripActionLines collapses the gap left by removed markers', () => {
  const out = stripActionLines('digest\n\n[TASK] a | 2026-01-01\n[TASK] b | 2026-01-02\n\nmore')
  assert.ok(!/\n{3,}/.test(out), 'excess blank lines left behind')
  assert.match(out, /digest/)
  assert.match(out, /more/)
})

// --- prompt construction ---

test('buildSystemPrompt includes the editable prompt document', () => {
  const out = buildSystemPrompt({
    ...agent,
    prompt: '## Machine format\nAlways emit [TASK] lines.',
  })
  assert.match(out, /Always emit \[TASK\] lines\./)
})

test('buildSystemPrompt includes description, role, preferences and output', () => {
  const out = buildSystemPrompt(agent)
  assert.match(out, /Email Summarizer/)
  assert.match(out, /Email assistant/)
  assert.match(out, /Summarize emails\./)
  assert.match(out, /Keeps it short/)
  assert.match(out, /Output format: message/)
})

test('buildSystemPrompt does not duplicate the description when it is also the prompt', () => {
  const doc = '## Mission\nOnly once.'
  const out = buildSystemPrompt({ ...agent, description: doc, prompt: doc })
  assert.equal(out.split(doc).length - 1, 1, 'description repeated')
})

test('buildSystemPrompt tolerates a null prompt', () => {
  const out = buildSystemPrompt({ ...agent, prompt: null })
  assert.match(out, /Email Summarizer/)
})

test('buildSystemPrompt lists sources only when present', () => {
  assert.ok(!buildSystemPrompt(agent).includes('Data sources'))
  assert.match(buildSystemPrompt({ ...agent, sources: ['hn'] }), /Data sources: hn/)
})

test('buildSystemPrompt always ends with the machine output contract', () => {
  const out = buildSystemPrompt(agent)
  const contractAt = out.indexOf('MACHINE OUTPUT CONTRACT')
  const docAt = out.indexOf('Summarize emails.')
  assert.ok(contractAt > -1, 'contract missing')
  assert.ok(contractAt > docAt, 'contract must come after user instructions')
  assert.match(out, /\[TASK\] <short imperative title> \| <YYYY-MM-DD>/)
  assert.match(out, /date must be its own pipe-delimited field/)
})

test('buildUserPrompt tells the model when there are no emails', () => {
  const out = buildUserPrompt(agent, {})
  assert.match(out, /none available/)
  assert.match(out, /instead of inventing emails/)
})

test('buildUserPrompt renders emails and news when present', () => {
  const out = buildUserPrompt(agent, {
    emails: [{ from: 'a@b.com', subject: 'Hi', snippet: 'there' }],
    news: [{ title: 'Story', source: 'hn' }],
  })
  assert.match(out, /From: a@b\.com \| Subject: Hi \| there/)
  assert.match(out, /\[hn\] Story/)
  assert.ok(!out.includes('none available'))
})
