import { generateText, generateObject } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ZodSchema } from 'zod'

export type LLMOptions = {
  apiKey: string
  /** Only used for error messages; routing is the caller's job. */
  provider?: string
  /**
   * Fully-resolved OpenAI-compatible base URL. Required — inferring a default
   * here is what previously sent every non-OpenRouter key to openrouter.ai.
   */
  baseUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
  schema?: ZodSchema
  maxOutputTokens?: number
  /** Injectable for tests. Defaults to global fetch. */
  fetch?: typeof fetch
}

export type LLMResult = {
  text?: string
  object?: unknown
  usage: { inputTokens: number; outputTokens: number }
}

export async function generateWithLLM(opts: LLMOptions): Promise<LLMResult> {
  const baseUrl = opts.baseUrl?.replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error(`No base URL resolved for provider "${opts.provider ?? 'unknown'}".`)
  }
  if (!opts.apiKey) {
    throw new Error(`No API key resolved for provider "${opts.provider ?? 'unknown'}" (baseUrl ${baseUrl}).`)
  }

  const provider = createOpenAICompatible({
    name: 'agent-provider',
    baseURL: baseUrl,
    apiKey: opts.apiKey,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  })

  const model = provider.chatModel(opts.model)
  const maxOutputTokens = opts.maxOutputTokens
    ? { maxOutputTokens: opts.maxOutputTokens }
    : {}

  // The system prompt must go through `system`, not a { role: 'system' } message.
  // AI SDK v5+ rejects system-role messages unless allowSystemInMessages is set,
  // which threw before any HTTP request was ever made.
  if (opts.schema) {
    const result = await generateObject({
      model,
      schema: opts.schema,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
      temperature: 0.2,
      ...maxOutputTokens,
    })
    return {
      object: result.object,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
    }
  }

  const result = await generateText({
    model,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
    temperature: 0.2,
    ...maxOutputTokens,
  })
  return {
    text: result.text,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  }
}
