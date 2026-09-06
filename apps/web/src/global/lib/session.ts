const REFRESH_TOKEN_KEY = 'ontrack-refresh-token'
const SESSION_EXPIRED_EVENT = 'ontrack:session-expired'

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

/** Clears both tokens locally and notifies listeners that the session is gone. */
export function clearSession(): void {
  accessToken = null
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export const SESSION_EXPIRED_EVENT_NAME = SESSION_EXPIRED_EVENT