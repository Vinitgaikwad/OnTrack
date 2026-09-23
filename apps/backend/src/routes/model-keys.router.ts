import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/model-keys.controller'

const modelKeysRouter = new Hono()
modelKeysRouter.use('*', authVerify)

modelKeysRouter.get('/', ctrl.handleListModelKeys)
modelKeysRouter.post('/', ctrl.handleCreateModelKey)
modelKeysRouter.delete('/:id', ctrl.handleDeleteModelKey)

export default modelKeysRouter
