/**
 * Provider routing + key validation.
 *
 * Deliberately dependency-free (no relative imports) so it can be unit tested
 * under Node's strip-only type stripping. Errors are returned, not thrown, so
 * the service layer can map them onto `AppError`.
 */

export type ProviderId = 'openrouter' | 'deepseek' | 'groq' | 'openai' | 'anthropic'

export type ProviderConfig = {
  id: ProviderId
  label: string
  /** OpenAI-compatible base URL. Requests go to `${baseUrl}/chat/completions`. */
  baseUrl: string | null
  /** Free endpoint used to verify an API key. Must not consume tokens. */
  validateUrl: string | null
  /** DeepSeek and friends are not directly reachable via the OpenAI wire format. */
  openAICompatible: boolean
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    validateUrl: 'https://openrouter.ai/api/v1/models',
    openAICompatible: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    validateUrl: 'https://api.deepseek.com/user/balance',
    openAICompatible: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    validateUrl: 'https://api.groq.com/openai/v1/models',
    openAICompatible: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    validateUrl: 'https://api.openai.com/v1/models',
    openAICompatible: true,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    // api.anthropic.com speaks the native Messages API, not OpenAI chat/completions.
    // Callers must supply an explicit OpenAI-compatible baseUrl (e.g. an OpenRouter key).
    baseUrl: null,
    validateUrl: null,
    openAICompatible: false,
  },
}

export const DEFAULT_PROVIDER: ProviderId = 'openrouter'
export const DEFAULT_BASE_URL = PROVIDERS.openrouter.baseUrl as string
export const FALLBACK_MODEL = 'anthropic/claude-3.5-sonnet'

/** Matches a stored/UI provider string like `DeepSeek` or `deepseek` to a known id. */
export function normalizeProvider(raw: string | null | undefined): ProviderId | null {
  if (!raw) return null
  const needle = raw.trim().toLowerCase()
  for (const config of Object.values(PROVIDERS)) {
    if (config.id === needle || config.label.toLowerCase() === needle) return config.id
  }
  return null
}

export function isKnownProvider(raw: string | null | undefined): boolean {
  return normalizeProvider(raw) !== null
}

/**
 * Resolves the base URL an agent run must use.
 * A base URL stored on the key always wins; otherwise fall back to the
 * provider default. Never silently returns null — a wrong default here sends
 * traffic to the wrong vendor's API and burns the key there.
 */
export function resolveBaseUrl(
  provider: string | null | undefined,
  storedBaseUrl?: string | null
): string {
  const explicit = storedBaseUrl?.trim()
  if (explicit) return stripTrailingSlash(explicit)

  const id = normalizeProvider(provider)
  const baseUrl = id ? PROVIDERS[id].baseUrl : null
  if (baseUrl) return baseUrl

  return DEFAULT_BASE_URL
}

/**
 * Resolves the endpoint used to validate a new API key.
 * Prefers a baseUrl supplied by the caller (self-hosted / proxy setups), then
 * the provider's own free validation endpoint.
 */
export function resolveValidateUrl(
  provider: string | null | undefined,
  storedBaseUrl?: string | null
): string {
  const explicit = storedBaseUrl?.trim()
  if (explicit) return `${stripTrailingSlash(explicit)}/models`

  const id = normalizeProvider(provider)
  const validateUrl = id ? PROVIDERS[id].validateUrl : null
  if (validateUrl) return validateUrl

  return PROVIDERS.openrouter.validateUrl as string
}

export type ValidateApiKeyInput = {
  provider: string
  apiKey: string
  baseUrl?: string | null
  fetch?: typeof fetch
}

export type ValidateApiKeyResult =
  | { ok: true; url: string }
  | { ok: false; code: string; message: string; status: number }

/**
 * Verifies an API key against the provider that will actually be used.
 * Uses only free endpoints, so adding a key never costs tokens.
 */
export async function validateApiKey(
  input: ValidateApiKeyInput
): Promise<ValidateApiKeyResult> {
  const id = normalizeProvider(input.provider)
  if (!id) {
    return {
      ok: false,
      code: 'INVALID_PROVIDER',
      message: `Unknown provider "${input.provider}". Supported: ${Object.values(PROVIDERS)
        .map((p) => p.label)
        .join(', ')}.`,
      status: 400,
    }
  }

  const config = PROVIDERS[id]
  if (!config.openAICompatible && !input.baseUrl?.trim()) {
    return {
      ok: false,
      code: 'UNSUPPORTED_PROVIDER',
      message: `${config.label} is not reachable through the OpenAI-compatible API this app uses. Provide a base URL (for example an OpenRouter endpoint) or pick another provider.`,
      status: 400,
    }
  }

  const url = resolveValidateUrl(input.provider, input.baseUrl)
  const doFetch = input.fetch ?? globalThis.fetch

  let response: Response
  try {
    response = await doFetch(url, { headers: { Authorization: `Bearer ${input.apiKey}` } })
  } catch {
    return {
      ok: false,
      code: 'VALIDATION_UNREACHABLE',
      message: `Could not reach ${url} to validate the key.`,
      status: 502,
    }
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      code: 'INVALID_KEY',
      message: `${config.label} rejected this API key.`,
      status: 400,
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: `Could not validate the key against ${config.label} (HTTP ${response.status}).`,
      status: 502,
    }
  }

  return { ok: true, url }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
