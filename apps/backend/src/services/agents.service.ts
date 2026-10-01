import type { AgentOutputType, Prisma, PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'
import { seedDefaultAgents } from './seed.service'

type Db = PrismaClient | Prisma.TransactionClient

async function findOwnedAgent(db: Db, userId: string, agentId: string) {
  const agent = await db.agent.findFirst({ where: { id: agentId, userId } })
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.', 404)
  return agent
}

export async function listAgents(db: Db, userId: string) {
  const count = await db.agent.count({ where: { userId } })
  if (count === 0) await seedDefaultAgents(db, userId)
  return db.agent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { tools: true },
  })
}

export async function getAgent(db: Db, userId: string, agentId: string) {
  const agent = await db.agent.findFirst({
    where: { id: agentId, userId },
    include: { tools: true },
  })
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.', 404)
  return agent
}

export async function createAgent(
  db: Db,
  userId: string,
  input: {
    name: string
    role: string
    icon: string
    color: string
    description: string
    preferences?: string[]
    templateId?: string
    prompt?: string
    sources?: string[]
    output?: AgentOutputType[]
    draftOnly?: boolean
    modelKeyId?: string | null
    maxTokens?: number
  }
) {
  let role = input.role
  let prompt = input.prompt ?? null
  let sources = input.sources ?? []
  let output = input.output ?? []
  let defaultTools: string[] = []

  if (input.templateId) {
    const template = await db.agentTemplate.findUnique({ where: { id: input.templateId } })
    if (!template) throw new AppError('NOT_FOUND', 'Agent template not found.', 404)
    role = role || template.defaultRole
    prompt = prompt || template.defaultPrompt
    sources = sources.length > 0 ? sources : template.defaultSources
    if (output.length === 0) output = template.defaultOutput
    defaultTools = template.defaultTools
  }

  // An agent with no destination would silently drop every run's output, so the
  // inbox is the floor rather than "write nowhere".
  if (output.length === 0) output = ['message']

  return db.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        userId,
        templateId: input.templateId ?? null,
        name: input.name,
        role,
        icon: input.icon,
        color: input.color,
        description: input.description,
        preferences: input.preferences ?? [],
        prompt,
        sources,
        output,
        draftOnly: input.draftOnly ?? true,
        modelKeyId: input.modelKeyId ?? null,
        maxTokens: input.maxTokens ?? 2000,
      },
      include: { tools: true },
    })

    if (defaultTools.length > 0) {
      await tx.agentTool.createMany({
        data: defaultTools.map((toolName) => ({
          agentId: agent.id,
          toolName,
          enabled: true,
        })),
      })
    }

    return tx.agent.findUnique({ where: { id: agent.id }, include: { tools: true } })
  })
}

export async function updateAgent(
  db: Db,
  userId: string,
  agentId: string,
  patch: {
    name?: string
    role?: string
    icon?: string
    color?: string
    description?: string
    preferences?: string[]
    prompt?: string
    sources?: string[]
    output?: AgentOutputType[]
    draftOnly?: boolean
    modelKeyId?: string | null
    maxTokens?: number
  }
) {
  await findOwnedAgent(db, userId, agentId)
  // Reject an empty set explicitly: it would make every future run a silent no-op.
  if (patch.output !== undefined && patch.output.length === 0) {
    throw new AppError('VALIDATION', 'Pick at least one place to deliver output.', 400)
  }
  return db.agent.update({
    where: { id: agentId },
    data: patch,
    include: { tools: true },
  })
}

export async function deleteAgent(db: Db, userId: string, agentId: string): Promise<void> {
  await findOwnedAgent(db, userId, agentId)
  await db.agent.delete({ where: { id: agentId } })
}
