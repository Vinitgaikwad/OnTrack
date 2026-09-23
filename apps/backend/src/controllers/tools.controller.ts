import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { fail, ok } from '../lib/http'
import { handle, validateBody } from '../lib/validate'
import * as toolsService from '../services/tools.service'

const idSchema = z.string().min(1).max(100)

const badParam = (c: Context) => fail(c, 'VALIDATION', 'Invalid parameter', 400)

const updateToolSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const handleListAvailableTools = (c: Context) =>
  handle(c, async () => {
    const tools = toolsService.listAvailableTools()
    return ok(c, tools)
  })

export const handleGetAgentTools = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const db = prismaClient(c.env.DATABASE_URL)
    const agentTools = await toolsService.getAgentTools(db, agentId)
    return ok(c, agentTools)
  })

export const handleUpdateAgentTool = (c: Context) =>
  handle(c, async () => {
    const agentId = idGuard(c.req.param('id'))
    if (!agentId) return badParam(c)
    const toolName = c.req.param('toolName')
    if (!toolName) return badParam(c)
    const body = await validateBody(c, updateToolSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const agentTool = await toolsService.upsertAgentTool(db, agentId, toolName, body.data)
    return ok(c, agentTool)
  })

function idGuard(raw: string | undefined): string | null {
  if (!raw) return null
  const parsed = idSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
