import { api } from '../lib/api'

export type GmailStatus = {
  isConnected: boolean
  email: string | null
}

export async function getGmailStatus(): Promise<GmailStatus> {
  return api<GmailStatus>('/api/auth/gmail/status')
}

export async function startGmailConnect(): Promise<string> {
  const result = await api<{ authUrl: string }>('/api/auth/gmail/connect')
  return result.authUrl
}

export async function disconnectGmailAccount(): Promise<boolean> {
  const result = await api<{ wasConnected: boolean }>('/api/auth/gmail', {
    method: 'DELETE',
  })
  return result.wasConnected
}
