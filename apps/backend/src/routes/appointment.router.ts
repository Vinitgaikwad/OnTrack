import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/appointment.controller'

const appointmentRouter = new Hono()
appointmentRouter.use('*', authVerify)

appointmentRouter.get('/', ctrl.handleListAppointments)
appointmentRouter.post('/', ctrl.handleCreateAppointment)
appointmentRouter.patch('/:id', ctrl.handleUpdateAppointment)
appointmentRouter.delete('/:id', ctrl.handleDeleteAppointment)

export default appointmentRouter