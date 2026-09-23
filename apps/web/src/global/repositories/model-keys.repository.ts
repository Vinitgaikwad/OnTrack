import { api } from '../lib/api'

export type ModelKeyDto = {
  id: string
  provider: string
  label: string
  defaultModel: string
  baseUrl?: string | null
  createdAt: string
}

export type CreateModelKeyInput = {
  provider: string
  label: string
  apiKey: string
  defaultModel: string
  baseUrl?: string
}

export async function listModelKeys(): Promise<ModelKeyDto[]> {
  return api<ModelKeyDto[]>('/api/model-keys')
}

export async function createModelKey(input: CreateModelKeyInput): Promise<ModelKeyDto> {
  return api<ModelKeyDto>('/api/model-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deleteModelKey(id: string): Promise<void> {
  await api<void>(`/api/model-keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
