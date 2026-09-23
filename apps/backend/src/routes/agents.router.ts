import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/agents.controller'

const agentsRouter = new Hono()
agentsRouter.use('*', authVerify)

agentsRouter.get('/', ctrl.handleListAgents)
agentsRouter.post('/', ctrl.handleCreateAgent)
agentsRouter.post('/:id/run', ctrl.handleRunAgent)
agentsRouter.get('/:id/runs', ctrl.handleListRuns)
agentsRouter.get('/:id', ctrl.handleGetAgent)
agentsRouter.patch('/:id', ctrl.handleUpdateAgent)
agentsRouter.delete('/:id', ctrl.handleDeleteAgent)

export default agentsRouter