import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRouter from './routes/auth.router'
import integrationsRouter from './routes/integrations.router'
import taskRouter from './routes/task.router'
import appointmentRouter from './routes/appointment.router'
import diaryRouter from './routes/diary.router'
import agentsRouter from './routes/agents.router'
import modelKeysRouter from './routes/model-keys.router'
import toolsRouter from './routes/tools.router'
import messagesRouter from './routes/messages.router'
import templatesRouter from './routes/templates.router'
import runsRouter from './routes/runs.router'
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
app.route('/api/auth/gmail', integrationsRouter)
app.route('/api/tasks', taskRouter)
app.route('/api/appointments', appointmentRouter)
app.route('/api/diary', diaryRouter)
app.route('/api/agents/messages', messagesRouter)
app.route('/api/agents', agentsRouter)
app.route('/api/model-keys', modelKeysRouter)
app.route('/api/tools', toolsRouter)
app.route('/api/templates', templatesRouter)
app.route('/api', runsRouter)

export default app