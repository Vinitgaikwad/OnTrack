import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/messages.controller'

const messagesRouter = new Hono()
messagesRouter.use('*', authVerify)

messagesRouter.get('/', ctrl.handleListMessages)
messagesRouter.patch('/:id', ctrl.handleMarkRead)
messagesRouter.delete('/:id', ctrl.handleDeleteMessage)

export default messagesRouter
