import { useState } from 'react'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { useModelKeysStore } from '../../global/stores/useModelKeysStore'
import { useToastStore } from '../../global/stores/useToastStore'

type ModelKeyModalProps = {
  open: boolean
  onClose: () => void
}

const PROVIDERS = ['OpenRouter', 'DeepSeek', 'Groq', 'OpenAI', 'Anthropic'] as const

export type ModelProvider = (typeof PROVIDERS)[number]

const MODEL_OPTIONS: Record<ModelProvider, string[]> = {
  OpenAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
  Anthropic: ['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-opus-4-1', 'claude-haiku-4-5'],
  Groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'],
  DeepSeek: ['deepseek-chat', 'deepseek-reasoner'],
  OpenRouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat'],
}

const CUSTOM_MODEL = '__custom__'

export function ModelKeyModal({ open, onClose }: ModelKeyModalProps) {
  const createKey = useModelKeysStore((state) => state.createKey)
  const pushToast = useToastStore((state) => state.push)

  const [provider, setProvider] = useState<ModelProvider>(PROVIDERS[0])
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelChoice, setModelChoice] = useState<string>(MODEL_OPTIONS[PROVIDERS[0]][0])
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const model = modelChoice === CUSTOM_MODEL ? customModel : modelChoice

  const handleProviderChange = (next: ModelProvider) => {
    setProvider(next)
    setModelChoice(MODEL_OPTIONS[next][0])
    setCustomModel('')
  }

  const handleSave = () => {
    if (!label.trim() || !apiKey.trim() || !model.trim()) return
    createKey({
      provider,
      label: label.trim(),
      apiKey: apiKey.trim(),
      defaultModel: model.trim(),
      baseUrl: baseUrl.trim() || undefined,
    })
    pushToast({ title: `${label.trim()} key added`, level: 'info' })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add model key" width="max-w-lg">
      <div className="flex flex-col gap-4">
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as ModelProvider)}
            className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none transition focus:border-(--accent)"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label="Label" hint="A friendly name for this key">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My OpenAI key" />
        </Field>

        <Field label="API Key">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </Field>

        <Field label="Model" hint={modelChoice === CUSTOM_MODEL ? 'Enter the exact model ID' : 'Picks a default for new agents'}>
          <select
            value={modelChoice}
            onChange={(e) => setModelChoice(e.target.value)}
            className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none transition focus:border-(--accent)"
          >
            {MODEL_OPTIONS[provider].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value={CUSTOM_MODEL}>Custom…</option>
          </select>
        </Field>

        {modelChoice === CUSTOM_MODEL ? (
          <Field label="Custom model ID">
            <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="gpt-4o" />
          </Field>
        ) : null}

        <Field label="Base URL" hint="Optional — pre-filled for known providers">
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!label.trim() || !apiKey.trim() || !model.trim()} onClick={handleSave}>
            Add key
          </Button>
        </div>
      </div>
    </Modal>
  )
}
