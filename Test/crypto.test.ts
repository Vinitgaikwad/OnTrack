import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encrypt, decrypt, maskKey } from '../apps/backend/src/lib/crypto.ts'

const KEY = 'a'.repeat(64) // 32 bytes hex
const OTHER_KEY = 'b'.repeat(64)

test('encrypt/decrypt roundtrip', async () => {
  const plaintext = 'sk-ant-1234567890abcdef'
  const ciphertext = await encrypt(plaintext, KEY)
  assert.notEqual(ciphertext, plaintext)
  assert.match(ciphertext, /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
  assert.equal(await decrypt(ciphertext, KEY), plaintext)
})

test('roundtrip preserves unicode and long values', async () => {
  const plaintext = 'héllo → 東京\n' + 'x'.repeat(5000)
  assert.equal(await decrypt(await encrypt(plaintext, KEY), KEY), plaintext)
})

test('decrypt fails with a different key', async () => {
  const ciphertext = await encrypt('secret', KEY)
  await assert.rejects(() => decrypt(ciphertext, OTHER_KEY))
})

test('decrypt rejects tampered ciphertext (GCM auth)', async () => {
  const ciphertext = await encrypt('secret', KEY)
  const [iv, ct] = ciphertext.split(':')
  const flipped = ct.slice(0, -1) + (ct.endsWith('A') ? 'B' : 'A')
  await assert.rejects(() => decrypt(`${iv}:${flipped}`, KEY))
})

test('decrypt rejects malformed ciphertext format', async () => {
  await assert.rejects(() => decrypt('not-a-valid-format', KEY))
  await assert.rejects(() => decrypt('onlyiv', KEY))
})

test('encrypt produces unique IVs (ciphertexts differ)', async () => {
  const a = await encrypt('same', KEY)
  const b = await encrypt('same', KEY)
  assert.notEqual(a, b)
})

test('maskKey masks the middle, keeps edges', () => {
  assert.equal(maskKey('sk-1234567890abcdef'), 'sk-1****cdef')
  assert.equal(maskKey('1234'), '****')
  assert.equal(maskKey('abcdefgh'), '****')
})