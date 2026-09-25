import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { generateWithLLM } from '../apps/backend/src/services/ai.service.ts'
import { resolveBaseUrl } from '../apps/backend/src/lib/llm-providers.ts'

type Sent = { url: string; init: RequestInit | undefined }

const COMPLETION = {
  id: 'chatcmpl-probe',
  object: 'chat.completion',
  created: 1_700_000_000,
  model: 'deepseek-chat',
  choices: [
    { index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' },
  ],
  usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 },
}

function stubFetch(): { sent: Sent[]; impl: typeof fetch } {
  const sent: Sent[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), init })
    return new Response(JSON.stringify(COMPLETION), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { sent, impl }
}

const baseOpts = { systemPrompt: 'you are a test', userPrompt: 'ping' }

/** Mirrors the agent runner: resolve the vendor from the key, then call. */
async function runAgentLike(provider: string, storedBaseUrl: string | null, apiKey = 'sk-test') {
  const { sent, impl } = stubFetch()
  const result = await generateWithLLM({
    ...baseOpts,
    apiKey,
    provider,
    baseUrl: resolveBaseUrl(provider, storedBaseUrl),
    model: 'deepseek-chat',
    fetch: impl,
  })
  return { sent, result }
}

// --- the regression: a DeepSeek agent run must POST to api.deepseek.com ---

test('a DeepSeek run POSTs to api.deepseek.com/chat/completions', async () => {
  const { sent, result } = await runAgentLike('DeepSeek', null)

  assert.equal(sent.length, 1, 'expected exactly one outbound request')
  const parsed = new URL(sent[0]!.url)
  assert.equal(parsed.host, 'api.deepseek.com', `request went to ${parsed.host}`)
  assert.equal(parsed.pathname, '/v1/chat/completions')
  assert.equal(result.text, 'pong')
  assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 3 })
})

test('a DeepSeek key with no stored baseUrl never reaches openrouter.ai', async () => {
  const { sent } = await runAgentLike('DeepSeek', null)
  assert.ok(
    !sent[0]!.url.includes('openrouter.ai'),
    `request leaked to OpenRouter: ${sent[0]!.url}`
  )
})

test('each provider run reaches its own host', async () => {
  const expected: Array<[string, string]> = [
    ['DeepSeek', 'api.deepseek.com'],
    ['OpenAI', 'api.openai.com'],
    ['Groq', 'api.groq.com'],
    ['OpenRouter', 'openrouter.ai'],
  ]

  for (const [provider, host] of expected) {
    const { sent } = await runAgentLike(provider, null)
    assert.equal(
      new URL(sent[0]!.url).host,
      host,
      `${provider} routed to ${new URL(sent[0]!.url).host}`
    )
  }
})

test('the request carries the auth header, model, and both messages', async () => {
  const { sent } = await runAgentLike('DeepSeek', null, 'sk-deepseek-key')

  const init = sent[0]!.init!
  // The SDK normalises header names to lowercase.
  const headers = Object.fromEntries(
    Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ])
  )
  assert.equal(headers['authorization'], 'Bearer sk-deepseek-key')

  const body = JSON.parse(init.body as string)
  assert.equal(body.model, 'deepseek-chat')
  assert.deepEqual(
    body.messages.map((m: { role: string }) => m.role),
    ['system', 'user']
  )
  assert.equal(body.messages[0].content, baseOpts.systemPrompt)
  assert.equal(body.messages[1].content, baseOpts.userPrompt)
})

test('the system prompt is sent as a system message on the wire', async () => {
  // Regression: passing { role: 'system' } into `messages` made AI SDK v7 throw
  // before any request left the process.
  const { sent } = await runAgentLike('DeepSeek', null)
  const body = JSON.parse(sent[0]!.init!.body as string)
  assert.equal(body.messages[0].role, 'system')
})

test('an explicit baseUrl overrides the provider default end to end', async () => {
  const { sent } = await runAgentLike('DeepSeek', 'https://proxy.internal/v1/')
  const parsed = new URL(sent[0]!.url)
  assert.equal(parsed.host, 'proxy.internal')
  assert.equal(parsed.pathname, '/v1/chat/completions', 'trailing slash should not double up')
})

// --- the regression: maxTokens was silently dropped by the AI SDK ---

test('maxOutputTokens actually reaches the request body', async () => {
  const { sent, impl } = stubFetch()
  await generateWithLLM({
    ...baseOpts,
    apiKey: 'sk-test',
    provider: 'DeepSeek',
    baseUrl: resolveBaseUrl('DeepSeek', null),
    model: 'deepseek-chat',
    maxOutputTokens: 512,
    fetch: impl,
  })
  const body = JSON.parse(sent[0]!.init!.body as string)
  assert.equal(body.max_tokens, 512)
})

test('no maxOutputTokens means the key is absent, not null', async () => {
  const { sent } = await runAgentLike('DeepSeek', null)
  const body = JSON.parse(sent[0]!.init!.body as string)
  assert.ok(!('max_tokens' in body), 'max_tokens should be omitted when unset')
})

// --- guard rails ---

test('a missing api key fails loudly instead of sending an unauthenticated request', async () => {
  const { sent, impl } = stubFetch()
  await assert.rejects(
    () =>
      generateWithLLM({
        ...baseOpts,
        apiKey: '',
        provider: 'DeepSeek',
        baseUrl: resolveBaseUrl('DeepSeek', null),
        model: 'deepseek-chat',
        fetch: impl,
      }),
    /No API key resolved/
  )
  assert.equal(sent.length, 0, 'must not hit the network without a key')
})

test('an empty baseUrl fails loudly instead of defaulting to a vendor', async () => {
  const { sent, impl } = stubFetch()
  await assert.rejects(
    () =>
      generateWithLLM({
        ...baseOpts,
        apiKey: 'sk-test',
        provider: 'DeepSeek',
        baseUrl: '',
        model: 'deepseek-chat',
        fetch: impl,
      }),
    /No base URL resolved/
  )
  assert.equal(sent.length, 0, 'must not hit the network without a base URL')
})

// --- wiring guards: catch a reintroduced hardcoded OpenRouter ---

const src = (rel: string) =>
  readFile(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

test('ai.service exposes no leftover maxTokens option (AI SDK v5+ uses maxOutputTokens)', async () => {
  const text = await src('../apps/backend/src/services/ai.service.ts')
  assert.ok(
    !/(?<!Output)maxTokens/.test(text),
    'ai.service still passes the removed `maxTokens` option, which the SDK silently ignores'
  )
})

test('ai.service does not import the routing table (callers must resolve the vendor)', async () => {
  const text = await src('../apps/backend/src/services/ai.service.ts')
  assert.ok(
    !text.includes('llm-providers'),
    'ai.service resolves base URLs itself again, which is how the wrong-vendor bug returned'
  )
  assert.ok(text.includes('No base URL resolved'), 'ai.service no longer requires a base URL')
})

test('model-keys service validates through the provider registry, not a hardcoded host', async () => {
  const text = await src('../apps/backend/src/services/model-keys.service.ts')
  assert.ok(text.includes('validateApiKey'), 'createModelKey no longer calls validateApiKey')
  const body = text.slice(text.indexOf('export async function createModelKey'))
  assert.ok(!body.includes('openrouter.ai'), 'createModelKey still hardcodes an OpenRouter URL')
})

test('agent runner resolves baseUrl per provider and passes it through', async () => {
  const text = await src('../apps/backend/src/services/agent.runner.ts')
  const block = text.slice(text.indexOf('let apiKey ='))
  assert.ok(block.includes('resolveBaseUrl'), 'agent runner no longer resolves baseUrl per provider')
  assert.ok(
    !/baseUrl\s*=\s*'https:\/\/openrouter/.test(block),
    'agent runner still hardcodes the OpenRouter baseUrl'
  )
  const call = text.slice(text.indexOf('generateWithLLM({'))
  assert.ok(call.includes('baseUrl,'), 'generateWithLLM is not given the resolved baseUrl')
  assert.ok(call.includes('maxOutputTokens:'), 'generateWithLLM still receives the dead maxTokens option')
})
