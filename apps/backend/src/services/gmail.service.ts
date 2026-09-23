import { encrypt, decrypt } from '../lib/crypto'

type GmailMessage = {
  subject: string
  from: string
  date: string
  snippet: string
  body: string
}

type TokenData = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'

export function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenData> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return res.json() as Promise<TokenData>
}

export async function fetchRecentEmails(
  accessToken: string,
  hoursBack = 24
): Promise<GmailMessage[]> {
  const query = `newer_than:${hoursBack}h`
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`)
  const listData = (await listRes.json()) as { messages?: Array<{ id: string }> }
  if (!listData.messages?.length) return []

  const messages = await Promise.all(
    listData.messages.map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            metadataFormat: 'metadata',
          },
        }
      )
      if (!msgRes.ok) return null
      const msg = (await msgRes.json()) as {
        snippet: string
        payload?: { headers: Array<{ name: string; value: string }> }
      }
      const headers = msg.payload?.headers || []
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
      return {
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: msg.snippet || '',
        body: msg.snippet || '',
      }
    })
  )
  return messages.filter((m): m is GmailMessage => m !== null)
}

export async function revokeTokens(
  refreshToken: string,
  clientId: string,
  _clientSecret: string
): Promise<void> {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: refreshToken,
      client_id: clientId,
    }),
  })
}

export async function encryptToken(
  plaintext: string,
  secretHex: string
): Promise<string> {
  return encrypt(plaintext, secretHex)
}

export async function decryptToken(
  ciphertext: string,
  secretHex: string
): Promise<string> {
  return decrypt(ciphertext, secretHex)
}
