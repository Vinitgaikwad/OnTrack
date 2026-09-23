import type { webcrypto } from 'crypto'

type CryptoKey = webcrypto.CryptoKey

const ALGO = 'AES-GCM'
const KEY_LENGTH = 32
const IV_LENGTH = 12

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function getKey(secretHex: string): Promise<CryptoKey> {
  const raw = hexToBytes(secretHex)
  return crypto.subtle.importKey('raw', raw, { name: ALGO }, false, ['encrypt', 'decrypt'])
}

export async function encrypt(plaintext: string, secretHex: string): Promise<string> {
  const key = await getKey(secretHex)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded)
  // Format: iv:ciphertext (both base64)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  return `${ivB64}:${ctB64}`
}

export async function decrypt(ciphertext: string, secretHex: string): Promise<string> {
  const [ivB64, ctB64] = ciphertext.split(':')
  if (!ivB64 || !ctB64) throw new Error('Invalid ciphertext format')
  const key = await getKey(secretHex)
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct)
  return new TextDecoder().decode(decrypted)
}

export function maskKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****'
  return apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
}
