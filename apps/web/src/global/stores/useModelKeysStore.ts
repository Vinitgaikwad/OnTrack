import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isAuthError, toErrorMessage } from '../lib/api'
import {
  createModelKey as createModelKeyReq,
  deleteModelKey as deleteModelKeyReq,
  listModelKeys as listModelKeysReq,
  type CreateModelKeyInput,
  type ModelKeyDto,
} from '../repositories/model-keys.repository'
import { useToastStore } from './useToastStore'

export type ModelKey = {
  id: string
  provider: string
  label: string
  defaultModel: string
  baseUrl?: string | null
  createdAt: string
}

type ModelKeysStore = {
  keys: ModelKey[]
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  epoch: number
  ensureLoaded: () => Promise<void>
  createKey: (input: {
    provider: string
    label: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  }) => Promise<boolean>
  deleteKey: (id: string) => Promise<void>
}

const toModelKey = (dto: ModelKeyDto): ModelKey => ({
  id: dto.id,
  provider: dto.provider,
  label: dto.label,
  defaultModel: dto.defaultModel,
  baseUrl: dto.baseUrl,
  createdAt: dto.createdAt,
})

function pushSyncError(error: unknown, title = "Couldn't sync model keys"): void {
  if (isAuthError(error)) return
  useToastStore.getState().push({
    title,
    message: toErrorMessage(error),
    level: 'error',
  })
}

async function refreshKeys(
  set: (state: Partial<ModelKeysStore & { epoch: number }>) => void,
  get: () => ModelKeysStore & { epoch: number }
): Promise<void> {
  const savedEpoch = get().epoch
  try {
    const dtos = await listModelKeysReq()
    if (get().epoch !== savedEpoch) return
    if (get().epoch === savedEpoch) set({ keys: dtos.map(toModelKey), loadStatus: 'loaded' })
  } catch (error) {
    pushSyncError(error)
  }
}

export const useModelKeysStore = create<ModelKeysStore>()(
  persist(
    (set, get) => ({
      keys: [],
      loadStatus: 'idle',
      epoch: 0,

      ensureLoaded: async () => {
        const { loadStatus } = get()
        if (loadStatus === 'loading' || loadStatus === 'loaded') return
        set({ loadStatus: 'loading' })
        try {
          const epoch = get().epoch
          const dtos = await listModelKeysReq()
          if (get().epoch !== epoch) return
          if (get().epoch === epoch) set({ keys: dtos.map(toModelKey), loadStatus: 'loaded' })
        } catch (error) {
          if (get().loadStatus === 'loading') set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      createKey: async (input) => {
        const optimistic: ModelKey = {
          id: `pending-${Date.now().toString(36)}`,
          provider: input.provider,
          label: input.label,
          defaultModel: input.defaultModel,
          baseUrl: input.baseUrl,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          keys: [...state.keys, optimistic],
          epoch: state.epoch + 1,
        }))
        try {
          const dto = await createModelKeyReq(input as CreateModelKeyInput)
          set((state) => ({
            keys: state.keys.map((k) => (k.id === optimistic.id ? toModelKey(dto) : k)),
          }))
          return true
        } catch (error) {
          pushSyncError(error, 'Could not add model key')
          set((state) => ({
            keys: state.keys.filter((k) => k.id !== optimistic.id),
          }))
          void refreshKeys(set, get)
          return false
        }
      },

      deleteKey: async (id) => {
        set((state) => ({
          keys: state.keys.filter((k) => k.id !== id),
          epoch: state.epoch + 1,
        }))
        try {
          await deleteModelKeyReq(id)
        } catch (error) {
          pushSyncError(error)
          void refreshKeys(set, get)
        }
      },
    }),
    {
      name: 'ontrack-model-keys',
      partialize: (state) => ({ keys: state.keys }),
    }
  )
)
