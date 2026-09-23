import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/agents.controller'

const templatesRouter = new Hono()
templatesRouter.use('*', authVerify)

templatesRouter.get('/', ctrl.handleListTemplates)

export default templatesRouter