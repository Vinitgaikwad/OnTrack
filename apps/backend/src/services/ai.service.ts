import { generateText, generateObject } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ZodSchema } from 'zod'

export type LLMOptions = {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
  schema?: ZodSchema
  maxTokens?: number
}

export type LLMResult = {
  text?: string
  object?: unknown
  usage: { inputTokens: number; outputTokens: number }
}

export async function generateWithLLM(opts: LLMOptions): Promise<LLMResult> {
  const provider = createOpenAICompatible({
    name: 'agent-provider',
    baseURL: opts.baseUrl || 'https://openrouter.ai/api/v1',
    apiKey: opts.apiKey,
  })

  const model = provider.chatModel(opts.model)

  if (opts.schema) {
    const result = await generateObject({
      model,
      schema: opts.schema,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      temperature: 0.2,
      ...(opts.maxTokens ? { maxTokens: opts.maxTokens } : {}),
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
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    temperature: 0.2,
    ...(opts.maxTokens ? { maxTokens: opts.maxTokens } : {}),
  })
  return {
    text: result.text,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  }
}
