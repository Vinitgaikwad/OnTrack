import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/diary.controller'

const diaryRouter = new Hono()
diaryRouter.use('*', authVerify)

diaryRouter.get('/', ctrl.handleListDiary)
diaryRouter.post('/', ctrl.handleCreateDiary)
diaryRouter.post('/unlock', ctrl.handleUnlockDiary)
diaryRouter.patch('/:id', ctrl.handleUpdateDiary)
diaryRouter.delete('/:id', ctrl.handleDeleteDiary)

export default diaryRouter