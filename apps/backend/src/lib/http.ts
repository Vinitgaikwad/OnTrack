import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export const ok = <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
  c.json({ data }, status)

export const fail = (
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode
) => c.json({ error: { code, message } }, status)

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: ContentfulStatusCode
  ) {
    super(message)
    this.name = 'AppError'
  }
}