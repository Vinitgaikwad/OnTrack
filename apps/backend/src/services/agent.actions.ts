import type { PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'

export type PendingActionKind = 'task' | 'event' | 'note'

export type PendingAction = {
  kind: PendingActionKind
  title: string
  date?: string
  startTime?: string
  endTime?: string | null
  note?: string
}

const MARKER_PREFIX = /^\[(?:TASK|EVENT|NOTE|INFO)\]/

const DATE_RE = /^\[TASK\]\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*$/
const EVENT_RE = /^\[EVENT\]\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{2}:\d{2})(?:\s*-\s*(\d{2}:\d{2}))?\s*$/
const NOTE_RE = /^\[NOTE\]\s*(.+?)\s*\|\s*(.+)$/

export function parseActionItems(text: string): PendingAction[] {
  const items: PendingAction[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    const task = DATE_RE.exec(line)
    if (task) {
      items.push({ kind: 'task', title: task[1].trim(), date: task[2] })
      continue
    }

    const event = EVENT_RE.exec(line)
    if (event) {
      items.push({
        kind: 'event',
        title: event[1].trim(),
        date: event[2],
        startTime: event[3],
        endTime: event[4] ?? null,
      })
      continue
    }

    const note = NOTE_RE.exec(line)
    if (note) {
      items.push({ kind: 'note', title: note[1].trim(), note: note[2].trim() })
      continue
    }
  }

  return items
}

export function stripActionLines(text: string): string {
  return text
    .split('\n')
    .map((rawLine) => rawLine.trimEnd())
    .filter((line) => (line.trim().length > 0 ? !MARKER_PREFIX.test(line.trim()) : true))
    .join('\n')
    .trim()
}

export async function createActionItems(
  db: PrismaClient,
  userId: string,
  items: PendingAction[]
): Promise<Array<{ kind: PendingActionKind; id: string }>> {
  if (items.length === 0) return []

  const created: Array<{ kind: PendingActionKind; id: string }> = []

  await db.$transaction(async (tx) => {
    for (const item of items) {
      if (item.kind === 'task' || item.kind === 'event') {
        if (!item.date) {
          throw new AppError('VALIDATION', `${item.kind} items must include a date.`, 400)
        }
        const appointment = await tx.appointment.create({
          data: {
            userId,
            kind: item.kind === 'event' ? 'appointment' : 'task',
            title: item.title,
            date: item.date,
            startTime: item.startTime ?? '09:00',
            endTime: item.endTime ?? null,
            color: item.kind === 'task' ? '#f59e0b' : '#8b5cf6',
            notes: item.note ?? '',
          },
        })
        created.push({ kind: item.kind, id: appointment.id })
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const entry = await tx.diaryEntry.create({
          data: {
            userId,
            title: item.title,
            content: item.note ?? '',
            mood: 'good',
            tags: ['agent-output'],
            date: today,
            hidden: false,
          },
        })
        created.push({ kind: 'note', id: entry.id })
      }
    }
  })

  return created
}