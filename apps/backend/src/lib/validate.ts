import { z } from 'zod'
import type { Context } from 'hono'
import { AppError, fail } from './http'

export type Validation<T> = { ok: true; data: T } | { ok: false; response: Response }

const firstIssue = (error: z.ZodError) =>
  error.issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ')

export async function validateBody<T extends z.ZodType>(
  c: Context,
  schema: T
): Promise<Validation<z.infer<T>>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { ok: false, response: fail(c, 'INVALID_JSON', 'Request body must be valid JSON', 400) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: fail(c, 'VALIDATION', firstIssue(parsed.error), 400) }
  }
  return { ok: true, data: parsed.data }
}

export function validateQuery<T extends z.ZodType>(
  c: Context,
  schema: T
): Validation<z.infer<T>> {
  const raw = c.req.queries()
  const obj: Record<string, unknown> = {}
  for (const [key, values] of Object.entries(raw)) {
    obj[key] = values.length <= 1 ? values[0] : values
  }
  const parsed = schema.safeParse(obj)
  if (!parsed.success) {
    return { ok: false, response: fail(c, 'VALIDATION', firstIssue(parsed.error), 400) }
  }
  return { ok: true, data: parsed.data }
}

export async function handle(
  c: Context,
  fn: () => Promise<Response | void>
): Promise<Response> {
  try {
    const response = await fn()
    if (response) return response
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof AppError) return fail(c, error.code, error.message, error.status)
    console.error('[ontrack] unhandled', error)
    return fail(c, 'INTERNAL', 'Something went wrong', 500)
  }
}

// Re-export for convenience in controllers/services.
export { AppError }