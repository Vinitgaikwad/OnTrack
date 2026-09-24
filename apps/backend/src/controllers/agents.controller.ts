import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody, validateQuery } from '../lib/validate'
import * as agentsService from '../services/agents.service'
import * as agentRunner from '../services/agent.runner'
import { createActionItems } from '../services/agent.actions'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid agent id', 400)

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string(),
  icon: z.string(),
  color: z.string(),
  description: z.string(),
  preferences: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  prompt: z.string().optional(),
  sources: z.array(z.string()).optional(),
  output: z.enum(['message', 'note', 'email']).optional(),
  draftOnly: z.boolean().optional(),
  modelKeyId: z.string().nullable().optional(),
  maxTokens: z.number().int().min(500).max(8000).optional(),
})

const updateAgentSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    description: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    prompt: z.string().optional(),
    sources: z.array(z.string()).optional(),
    output: z.enum(['message', 'note', 'email']).optional(),
    draftOnly: z.boolean().optional(),
    modelKeyId: z.string().nullable().optional(),
    maxTokens: z.number().int().min(500).max(8000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const handleListAgents = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const agents = await agentsService.listAgents(db, c.get('userId'))
    return ok(c, agents)
  })

export const handleGetAgent = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    const agent = await agentsService.getAgent(db, c.get('userId'), agentId)
    return ok(c, agent)
  })

export const handleCreateAgent = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, createAgentSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const agent = await agentsService.createAgent(db, c.get('userId'), body.data)
    return ok(c, agent, 201)
  })

export const handleUpdateAgent = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const body = await validateBody(c, updateAgentSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const agent = await agentsService.updateAgent(db, c.get('userId'), agentId, body.data)
    return ok(c, agent)
  })

export const handleDeleteAgent = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    await agentsService.deleteAgent(db, c.get('userId'), agentId)
  })

export const handleRunAgent = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    const result = await agentRunner.runAgent(db, c.get('userId'), agentId, c.env)
    return ok(c, result)
  })

const actionItemSchema = z.object({
  kind: z.enum(['task', 'event', 'note']),
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  note: z.string().max(2000).optional(),
})

const confirmActionsSchema = z.object({
  items: z.array(actionItemSchema).min(1).max(25),
})

export const handleConfirmActions = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, confirmActionsSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const created = await createActionItems(db, c.get('userId'), body.data.items)
    return ok(c, { created })
  })

const listRunsSchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const handleListRuns = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const query = validateQuery(c, listRunsSchema)
    if (!query.ok) return query.response
    const db = prismaClient(c.env.DATABASE_URL)
    const result = await agentRunner.listAgentRuns(db, c.get('userId'), {
      ...query.data,
      agentId,
    })
    return ok(c, result)
  })

export const handleGetRun = (c: Context) =>
  handle(c, async () => {
    const runId = idGuard(c.req.param('runId'))
    if (!runId) return fail(c, 'VALIDATION', 'Invalid run id', 400)
    const db = prismaClient(c.env.DATABASE_URL)
    const run = await agentRunner.getAgentRun(db, c.get('userId'), runId)
    return ok(c, run)
  })

const listTemplatesSchema = z.object({})

export const handleListTemplates = (c: Context) =>
  handle(c, async () => {
    const { seedTemplates, listTemplates } = await import('../services/seed.service')
    const db = prismaClient(c.env.DATABASE_URL)
    await seedTemplates(db)
    const templates = await listTemplates(db)
    return ok(c, templates)
  })

function idGuard(raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
