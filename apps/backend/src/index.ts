import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRouter from './routes/auth.router'
import taskRouter from './routes/task.router'
import appointmentRouter from './routes/appointment.router'
import type { AppVariables, Env } from './types'

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/api/auth', authRouter)
app.route('/api/tasks', taskRouter)
app.route('/api/appointments', appointmentRouter)

export default app