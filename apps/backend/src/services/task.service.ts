import type { Prisma, PrismaClient, TaskStatus } from '../generated/prisma/client'
import { AppError } from '../lib/http'

const POSITION_OFFSET = 1_000_000

type Db = PrismaClient | Prisma.TransactionClient

async function findOwnedTask(db: Db, userId: string, taskId: string) {
  const task = await db.task.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new AppError('NOT_FOUND', 'Task not found.', 404)
  return task
}

// Rewrites 0..n-1 positions across the whole column. Shifts everything up by a large
// offset first to avoid transient unique (userId, status, position) conflicts.
async function repositionColumn(db: Db, userId: string, status: TaskStatus, orderedIds: string[]): Promise<void> {
  const existing = await db.task.findMany({ where: { userId, status } })
  await Promise.all(
    existing.map((task) =>
      db.task.update({ where: { id: task.id }, data: { position: task.position + POSITION_OFFSET } })
    )
  )
  await Promise.all(
    orderedIds.map((id, index) => db.task.update({ where: { id }, data: { position: index } }))
  )
}

export async function listTasks(db: Db, userId: string, status?: TaskStatus) {
  return db.task.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: [{ status: 'asc' }, { position: 'asc' }],
  })
}

export async function createTask(
  db: Db,
  userId: string,
  input: {
    id?: string
    title: string
    text: string
    priority: 'low' | 'medium' | 'high' | 'daily'
    dueDate: string | null
    createdAt?: number | null
  }
) {
  const last = await db.task.findFirst({
    where: { userId, status: 'todo' },
    orderBy: { position: 'desc' },
  })
  return db.task.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      userId,
      title: input.title,
      text: input.text ?? '',
      priority: input.priority ?? 'medium',
      status: 'todo',
      position: (last?.position ?? -1) + 1,
      dueDate: input.dueDate,
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
    },
  })
}

export async function updateTask(
  db: Db,
  userId: string,
  taskId: string,
  patch: {
    title?: string
    text?: string
    priority?: 'low' | 'medium' | 'high' | 'daily'
    dueDate?: string | null
  }
) {
  await findOwnedTask(db, userId, taskId)
  return db.task.update({ where: { id: taskId }, data: patch })
}

export async function moveTask(
  db: Db,
  userId: string,
  taskId: string,
  input: { to: TaskStatus; toIndex?: number }
) {
  const task = await findOwnedTask(db, userId, taskId)
  const to = input.to
  const toIndex = input.toIndex === undefined ? -1 : Math.max(0, input.toIndex)

  await db.$transaction(async (tx) => {
    if (task.status !== to) {
      // Flip status and park the position high above the 1,000,000-offset bump zone in one
      // write, so (userId, status, position) can't collide with an existing target row that
      // happens to hold the task's old source position.
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: to,
          position: POSITION_OFFSET * 3,
          doneAt: to === 'done' ? new Date() : null,
        },
      })

      // Reindex the source column after the task leaves it.
      const source = await tx.task.findMany({
        where: { userId, status: task.status },
        orderBy: { position: 'asc' },
      })
      await repositionColumn(
        tx,
        userId,
        task.status,
        source.filter((t) => t.id !== taskId).map((t) => t.id)
      )

      // Insert into the target column at the requested index (the task is already
      // in the target status now, so drop it from the list before splicing).
      const target = await tx.task.findMany({
        where: { userId, status: to },
        orderBy: { position: 'asc' },
      })
      const insertAt = toIndex === -1 ? target.length : Math.min(toIndex, target.length)
      const targetIds = target.map((t) => t.id).filter((id) => id !== taskId)
      targetIds.splice(insertAt, 0, taskId)
      await repositionColumn(tx, userId, to, targetIds)
    } else {
      const column = await tx.task.findMany({
        where: { userId, status: to },
        orderBy: { position: 'asc' },
      })
      const insertAt = toIndex === -1 ? column.length : Math.min(toIndex, column.length)
      const ids = column.map((t) => t.id)
      const from = ids.indexOf(taskId)
      if (from >= 0) ids.splice(from, 1)
      ids.splice(insertAt, 0, taskId)
      await repositionColumn(tx, userId, to, ids)
    }
  })

  return db.task.findUnique({ where: { id: taskId } })
}

export async function deleteTask(db: Db, userId: string, taskId: string): Promise<void> {
  const task = await findOwnedTask(db, userId, taskId)
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } })
    const remaining = await tx.task.findMany({
      where: { userId, status: task.status },
      orderBy: { position: 'asc' },
    })
    await repositionColumn(
      tx,
      userId,
      task.status,
      remaining.map((t) => t.id)
    )
  })
}