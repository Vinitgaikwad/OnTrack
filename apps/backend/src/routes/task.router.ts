import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/task.controller'

const taskRouter = new Hono()
taskRouter.use('*', authVerify)

taskRouter.get('/', ctrl.handleListTasks)
taskRouter.post('/', ctrl.handleCreateTask)
taskRouter.patch('/:id/move', ctrl.handleMoveTask)
taskRouter.patch('/:id', ctrl.handleUpdateTask)
taskRouter.delete('/:id', ctrl.handleDeleteTask)

export default taskRouter