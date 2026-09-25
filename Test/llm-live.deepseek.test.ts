/**
 * Live smoke test against the real DeepSeek API.
 *
 * Opt in with DEEPSEEK_LIVE=confirm so a stray env var in CI cannot start
 * spending tokens. The key is read from DEEPSEEK_API_KEY, falling back to the
 * gitignored apps/backend/.dev.vars.
 *
 *   cmd.exe      :  set DEEPSEEK_LIVE=confirm && npm test
 *   PowerShell   :  $env:DEEPSEEK_LIVE='confirm'; npm test
 *
 * Costs one minimal completion (<100 tokens) plus a free balance check.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { generateWithLLM } from '../apps/backend/src/services/ai.service.ts'
import {
  PROVIDERS,
  resolveBaseUrl,
  resolveValidateUrl,
  validateApiKey,
} from '../apps/backend/src/lib/llm-providers.ts'

async function readKey(): Promise<string | undefined> {
  if (process.env.DEEPSEEK_API_KEY?.trim()) return process.env.DEEPSEEK_API_KEY.trim()
  try {
    const vars = await readFile(
      fileURLToPath(new URL('../apps/backend/.dev.vars', import.meta.url)),
      'utf8'
    )
    return vars.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(.+)$/m)?.[1]?.trim()
  } catch {
    return undefined
  }
}

const key = await readKey()

// `set DEEPSEEK_LIVE=confirm && npm test` in cmd.exe leaves a trailing space in
// the value, so trim before comparing.
const confirmed = (process.env.DEEPSEEK_LIVE ?? '').trim().toLowerCase() === 'confirm'
const skip = !key || !confirmed
if (!skip) {
  console.log('[live] DEEPSEEK_LIVE=confirm -> hitting the real DeepSeek API')
}

test('live: DeepSeek key validates on the free balance endpoint', { skip }, async () => {
  const result = await validateApiKey({ provider: 'DeepSeek', apiKey: key! })
  assert.equal(result.ok, true, `validation failed: ${JSON.stringify(result)}`)
  assert.equal(
    new URL((result as { url: string }).url).host,
    'api.deepseek.com',
    'validation must not leave DeepSeek'
  )
})

test('live: registry points DeepSeek at the real API', { skip }, () => {
  assert.equal(resolveBaseUrl('DeepSeek', null), 'https://api.deepseek.com/v1')
  assert.equal(resolveValidateUrl('DeepSeek', null), 'https://api.deepseek.com/user/balance')
  assert.equal(PROVIDERS.deepseek.baseUrl, 'https://api.deepseek.com/v1')
})

test('live: a real agent-shaped call reaches DeepSeek and returns text', { skip }, async () => {
  const result = await generateWithLLM({
    apiKey: key!,
    provider: 'DeepSeek',
    baseUrl: resolveBaseUrl('DeepSeek', null),
    model: 'deepseek-chat',
    systemPrompt: 'You reply with exactly one word.',
    userPrompt: 'ping',
    maxOutputTokens: 16,
  })

  assert.ok(result.text, 'expected text from DeepSeek')
  assert.match(result.text.trim(), /pong/i)
  assert.ok(result.usage.inputTokens > 0, 'expected a non-zero prompt token count')
  assert.ok(
    result.usage.outputTokens > 0,
    'expected a non-zero completion token count'
  )
  // The dashboard shows this run; if it does not appear, routing is still wrong.
  assert.ok(result.usage.outputTokens <= 16, 'output should respect maxOutputTokens')
})
