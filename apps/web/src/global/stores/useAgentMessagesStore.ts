import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isAuthError, toErrorMessage } from '../lib/api'
import {
  deleteMessage as deleteMessageReq,
  listMessages as listMessagesReq,
  markRead as markReadReq,
  type AgentMessageDto,
} from '../repositories/messages.repository'
import { useToastStore } from './useToastStore'

export type AgentMessage = {
  id: string
  agentId: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

type AgentMessagesStore = {
  messages: AgentMessage[]
  hasMore: boolean
  unreadCount: number
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  offset: number
  epoch: number
  ensureLoaded: () => Promise<void>
  loadMore: () => Promise<void>
  markRead: (id: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
}

const PAGE_SIZE = 20

const toMessage = (dto: AgentMessageDto): AgentMessage => ({
  id: dto.id,
  agentId: dto.agentId,
  title: dto.title,
  body: dto.body,
  read: dto.read,
  createdAt: dto.createdAt,
})

function pushSyncError(error: unknown): void {
  if (isAuthError(error)) return
  useToastStore.getState().push({
    title: "Couldn't sync messages",
    message: toErrorMessage(error),
    level: 'error',
  })
}

async function refreshMessages(
  set: (state: Partial<AgentMessagesStore & { epoch: number }>) => void,
  get: () => AgentMessagesStore & { epoch: number }
): Promise<void> {
  const savedEpoch = get().epoch
  try {
    const result = await listMessagesReq({ offset: 0, limit: PAGE_SIZE })
    if (get().epoch !== savedEpoch) return
    if (get().epoch === savedEpoch) {
      const msgs = result.messages.map(toMessage)
      set({
        messages: msgs,
        hasMore: result.hasMore,
        offset: msgs.length,
        loadStatus: 'loaded',
      })
    }
  } catch (error) {
    pushSyncError(error)
  }
}

export const useAgentMessagesStore = create<AgentMessagesStore>()(
  persist(
    (set, get) => ({
      messages: [],
      hasMore: false,
      unreadCount: 0,
      loadStatus: 'idle',
      offset: 0,
      epoch: 0,

      ensureLoaded: async () => {
        const { loadStatus } = get()
        if (loadStatus === 'loading' || loadStatus === 'loaded') return
        set({ loadStatus: 'loading' })
        try {
          const epoch = get().epoch
          const result = await listMessagesReq({ offset: 0, limit: PAGE_SIZE })
          if (get().epoch !== epoch) return
          const msgs = result.messages.map(toMessage)
          const unreadCount = msgs.filter((m) => !m.read).length
          if (get().epoch === epoch) {
            set({
              messages: msgs,
              hasMore: result.hasMore,
              unreadCount,
              offset: msgs.length,
              loadStatus: 'loaded',
            })
          }
        } catch (error) {
          if (get().loadStatus === 'loading') set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      loadMore: async () => {
        const { loadStatus, hasMore } = get()
        if (loadStatus !== 'loaded' || !hasMore) return
        set({ loadStatus: 'loading' })
        try {
          const epoch = get().epoch
          const offset = get().offset
          const result = await listMessagesReq({ offset, limit: PAGE_SIZE })
          if (get().epoch !== epoch) return
          const msgs = result.messages.map(toMessage)
          if (get().epoch === epoch) {
            set((state) => ({
              messages: [...state.messages, ...msgs],
              hasMore: result.hasMore,
              offset: offset + msgs.length,
              loadStatus: 'loaded',
            }))
          }
        } catch (error) {
          if (get().loadStatus === 'loading') set({ loadStatus: 'error' })
          pushSyncError(error)
        }
      },

      markRead: async (id) => {
        const prev = get().messages.find((m) => m.id === id)
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, read: true } : m)),
          unreadCount: Math.max(0, state.unreadCount - (prev?.read ? 0 : 1)),
          epoch: state.epoch + 1,
        }))
        try {
          await markReadReq(id)
        } catch (error) {
          pushSyncError(error)
          void refreshMessages(set, get)
        }
      },

      deleteMessage: async (id) => {
        const prev = get().messages.find((m) => m.id === id)
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
          unreadCount: Math.max(0, state.unreadCount - (prev?.read ? 0 : 1)),
          epoch: state.epoch + 1,
        }))
        try {
          await deleteMessageReq(id)
        } catch (error) {
          pushSyncError(error)
          void refreshMessages(set, get)
        }
      },
    }),
    {
      name: 'ontrack-agent-messages',
      partialize: (state) => ({
        messages: state.messages,
        hasMore: state.hasMore,
        unreadCount: state.unreadCount,
      }),
    }
  )
)
