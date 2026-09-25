import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVIDERS,
  DEFAULT_BASE_URL,
  FALLBACK_MODEL,
  normalizeProvider,
  isKnownProvider,
  resolveBaseUrl,
  resolveValidateUrl,
  validateApiKey,
  type ValidateApiKeyResult,
} from '../apps/backend/src/lib/llm-providers.ts'

const ok = () => new Response('{}', { status: 200 })

function recorder(respond: (url: string) => Response = ok) {
  const urls: string[] = []
  const headers: Record<string, string>[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    urls.push(url)
    headers.push((init?.headers ?? {}) as Record<string, string>)
    return respond(url)
  }) as typeof fetch
  return { urls, headers, impl }
}

function assertFailure(result: ValidateApiKeyResult, code: string) {
  assert.equal(result.ok, false, `expected failure ${code}, got ${JSON.stringify(result)}`)
  assert.equal(result.ok === false && result.code, code)
}

// --- the regression: DeepSeek keys must validate against DeepSeek ---

test('DeepSeek key validation hits api.deepseek.com, not OpenRouter', async () => {
  const rec = recorder()
  const result = await validateApiKey({ provider: 'DeepSeek', apiKey: 'sk-test', fetch: rec.impl })

  assert.equal(result.ok, true, `DeepSeek key was rejected: ${JSON.stringify(result)}`)
  assert.equal(rec.urls.length, 1)
  const host = new URL(rec.urls[0]!).host
  assert.equal(host, 'api.deepseek.com', `validation hit ${host} instead of api.deepseek.com`)
  assert.equal(rec.headers[0]!['Authorization'], 'Bearer sk-test')
})

test('every provider validates against its own host', async () => {
  const expected: Record<string, string> = {
    openrouter: 'openrouter.ai',
    deepseek: 'api.deepseek.com',
    groq: 'api.groq.com',
    openai: 'api.openai.com',
  }

  for (const [id, host] of Object.entries(expected)) {
    const rec = recorder()
    const result = await validateApiKey({ provider: id, apiKey: 'sk-test', fetch: rec.impl })
    assert.equal(result.ok, true, `provider ${id} rejected: ${JSON.stringify(result)}`)
    assert.equal(new URL(rec.urls[0]!).host, host, `provider ${id} validated on wrong host`)
  }
})

test('validation endpoints are token-free (no chat/completions calls)', () => {
  for (const config of Object.values(PROVIDERS)) {
    if (!config.validateUrl) continue
    assert.ok(
      !config.validateUrl.includes('chat/completions'),
      `${config.id} validation would spend tokens`
    )
  }
})

test('a key rejected by its provider reports INVALID_KEY', async () => {
  const rec = recorder(() => new Response('nope', { status: 401 }))
  assertFailure(
    await validateApiKey({ provider: 'DeepSeek', apiKey: 'bad', fetch: rec.impl }),
    'INVALID_KEY'
  )
})

test('403 is treated as an invalid key too', async () => {
  const rec = recorder(() => new Response('nope', { status: 403 }))
  assertFailure(
    await validateApiKey({ provider: 'DeepSeek', apiKey: 'bad', fetch: rec.impl }),
    'INVALID_KEY'
  )
})

test('an unreachable host reports VALIDATION_UNREACHABLE, not INVALID_KEY', async () => {
  const impl = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
  assertFailure(
    await validateApiKey({ provider: 'DeepSeek', apiKey: 'sk', fetch: impl }),
    'VALIDATION_UNREACHABLE'
  )
})

test('an unexpected status reports VALIDATION_FAILED', async () => {
  const rec = recorder(() => new Response('boom', { status: 500 }))
  assertFailure(
    await validateApiKey({ provider: 'DeepSeek', apiKey: 'sk', fetch: rec.impl }),
    'VALIDATION_FAILED'
  )
})

test('unknown provider is rejected before any network call', async () => {
  const rec = recorder()
  assertFailure(
    await validateApiKey({ provider: 'NotAProvider', apiKey: 'sk', fetch: rec.impl }),
    'INVALID_PROVIDER'
  )
  assert.equal(rec.urls.length, 0)
})

test('Anthropic without a baseUrl is rejected (not OpenAI-compatible)', async () => {
  const rec = recorder()
  assertFailure(
    await validateApiKey({ provider: 'Anthropic', apiKey: 'sk', fetch: rec.impl }),
    'UNSUPPORTED_PROVIDER'
  )
  assert.equal(rec.urls.length, 0)
})

test('Anthropic with an explicit OpenAI-compatible baseUrl validates against it', async () => {
  const rec = recorder()
  const result = await validateApiKey({
    provider: 'Anthropic',
    apiKey: 'sk',
    baseUrl: 'https://openrouter.ai/api/v1',
    fetch: rec.impl,
  })
  assert.equal(result.ok, true)
  assert.equal(new URL(rec.urls[0]!).host, 'openrouter.ai')
})

// --- the regression: runs must resolve the right base URL ---

test('resolveBaseUrl sends DeepSeek to api.deepseek.com when no baseUrl is stored', () => {
  assert.equal(resolveBaseUrl('DeepSeek', null), 'https://api.deepseek.com/v1')
  assert.equal(resolveBaseUrl('deepseek', undefined), 'https://api.deepseek.com/v1')
  assert.equal(resolveBaseUrl('DeepSeek', ''), 'https://api.deepseek.com/v1')
})

test('resolveBaseUrl never falls back to OpenRouter for a known provider', () => {
  for (const config of Object.values(PROVIDERS)) {
    if (!config.baseUrl) continue
    assert.equal(
      resolveBaseUrl(config.label, null),
      config.baseUrl,
      `${config.id} resolved to the wrong base URL`
    )
    if (config.id === 'openrouter') continue
    assert.notEqual(
      resolveBaseUrl(config.label, null),
      DEFAULT_BASE_URL,
      `${config.id} silently resolved to OpenRouter`
    )
  }
})

test('a stored baseUrl always wins over the provider default', () => {
  assert.equal(
    resolveBaseUrl('DeepSeek', 'https://proxy.internal/v1/'),
    'https://proxy.internal/v1'
  )
  assert.equal(resolveBaseUrl('OpenRouter', 'https://proxy.internal/v1'), 'https://proxy.internal/v1')
})

test('unknown or missing provider falls back to OpenRouter, not null', () => {
  assert.equal(resolveBaseUrl('MysteryCorp', null), DEFAULT_BASE_URL)
  assert.equal(resolveBaseUrl(null, null), DEFAULT_BASE_URL)
  assert.equal(resolveBaseUrl(undefined, undefined), DEFAULT_BASE_URL)
})

test('resolveValidateUrl prefers an explicit baseUrl over the provider default', () => {
  assert.equal(
    resolveValidateUrl('DeepSeek', 'https://proxy.internal/v1'),
    'https://proxy.internal/v1/models'
  )
  assert.equal(resolveValidateUrl('MysteryCorp', null), 'https://openrouter.ai/api/v1/models')
})

test('resolveValidateUrl is stable under trailing slashes', () => {
  assert.equal(
    resolveValidateUrl('DeepSeek', 'https://proxy.internal/v1///'),
    'https://proxy.internal/v1/models'
  )
})

// --- provider name normalization (UI sends `DeepSeek`, data model says `deepseek`) ---

test('normalizeProvider is case-insensitive and accepts both id and label', () => {
  assert.equal(normalizeProvider('DeepSeek'), 'deepseek')
  assert.equal(normalizeProvider('deepseek'), 'deepseek')
  assert.equal(normalizeProvider('DEEPSEEK'), 'deepseek')
  assert.equal(normalizeProvider('  DeepSeek  '), 'deepseek')
  assert.equal(normalizeProvider('openrouter'), 'openrouter')
  assert.equal(normalizeProvider('OpenRouter'), 'openrouter')
  assert.equal(normalizeProvider('OpenAI'), 'openai')
})

test('normalizeProvider returns null for unknown or empty input', () => {
  assert.equal(normalizeProvider(''), null)
  assert.equal(normalizeProvider('   '), null)
  assert.equal(normalizeProvider('nope'), null)
  assert.equal(normalizeProvider(null), null)
  assert.equal(normalizeProvider(undefined), null)
  assert.equal(isKnownProvider('nope'), false)
  assert.equal(isKnownProvider('DeepSeek'), true)
})

test('fallback model is a valid OpenRouter-style model id', () => {
  assert.match(FALLBACK_MODEL, /^[a-z0-9.-]+\/[a-z0-9.-]+$/)
  assert.equal(PROVIDERS.openrouter.baseUrl, 'https://openrouter.ai/api/v1')
})
