import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './session'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let refreshPromise: Promise<boolean> | null = null

async function exchangeRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.data?.accessToken) return false
    setAccessToken(body.data.accessToken)
    if (body.data.refreshToken) setRefreshToken(body.data.refreshToken)
    return true
  } catch {
    return false
  }
}

/** Returns true when a usable access token is available, refreshing if needed. */
export async function ensureFreshSession(force = false): Promise<boolean> {
  if (!force && getAccessToken()) return true
  if (!getRefreshToken()) return false
  refreshPromise ??= exchangeRefreshToken().finally(() => {
    refreshPromise = null
  })
  const ok = await refreshPromise
  if (!ok) clearSession()
  return ok
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true
): Promise<T> {
  const token = getAccessToken()
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await ensureFreshSession(true)
    if (refreshed) return api<T>(path, init, false)
    clearSession()
    throw new ApiError('AUTH_REQUIRED', 'Your session has expired. Please sign in again.', 401)
  }

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const code = body?.error?.code ?? 'UNKNOWN'
    const message = body?.error?.message ?? `Request failed (${response.status})`
    throw new ApiError(code, message, response.status)
  }
  return body?.data as T
}

/** Returns true when the error means the session is gone (user must re-authenticate). */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AUTH_REQUIRED'
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}