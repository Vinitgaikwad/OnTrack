import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/integrations.controller'

const integrationsRouter = new Hono()

integrationsRouter.get('/connect', authVerify, ctrl.handleConnectGmail)
integrationsRouter.get('/callback', ctrl.handleGmailCallback)
integrationsRouter.get('/status', authVerify, ctrl.handleGmailStatus)
integrationsRouter.delete('/', authVerify, ctrl.handleDisconnectGmail)

export default integrationsRouter
