import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/tools.controller'

const toolsRouter = new Hono()
toolsRouter.use('*', authVerify)

toolsRouter.get('/available', ctrl.handleListAvailableTools)
toolsRouter.get('/agents/:id/tools', ctrl.handleGetAgentTools)
toolsRouter.patch('/agents/:id/tools/:toolName', ctrl.handleUpdateAgentTool)

export default toolsRouter
