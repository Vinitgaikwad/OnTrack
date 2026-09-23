import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/agents.controller'

const runsRouter = new Hono()
runsRouter.use('*', authVerify)

runsRouter.get('/runs/:runId', ctrl.handleGetRun)

export default runsRouter