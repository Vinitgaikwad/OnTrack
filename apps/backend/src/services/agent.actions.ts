import type { PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'
import {
  parseActionItems,
  stripActionLines,
  type PendingAction,
  type PendingActionKind,
} from '../lib/agent-prompts'

// Re-exported so existing imports keep working.
export { parseActionItems, stripActionLines }
export type { PendingAction, PendingActionKind }

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