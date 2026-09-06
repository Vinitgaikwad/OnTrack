import { createMiddleware } from 'hono/factory'
import { verifyAccessToken } from '../lib/jwt'
import { fail } from '../lib/http'

export const authVerify = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return fail(c, 'UNAUTHORIZED', 'Missing access token', 401)
  }
  try {
    const userId = await verifyAccessToken(token, c.env.JWT_SECRET)
    c.set('userId', userId)
    await next()
  } catch {
    return fail(c, 'UNAUTHORIZED', 'Invalid or expired access token', 401)
  }
})