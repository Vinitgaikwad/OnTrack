import { create } from 'zustand'
import {
  disconnectGmailAccount,
  getGmailStatus,
  startGmailConnect,
  type GmailStatus,
} from '../repositories/integrations.repository'

type IntegrationsState = {
  isGmailConnected: boolean
  gmailEmail: string | null
  isGmailLoading: boolean
  isGmailConnecting: boolean
  gmailError: string | null
  refreshGmail: () => Promise<void>
  connectGmail: () => Promise<void>
  disconnectGmail: () => Promise<void>
}

export const useIntegrationsStore = create<IntegrationsState>((set) => ({
  isGmailConnected: false,
  gmailEmail: null,
  isGmailLoading: false,
  isGmailConnecting: false,
  gmailError: null,

  refreshGmail: async () => {
    set({ isGmailLoading: true, gmailError: null })
    try {
      const status: GmailStatus = await getGmailStatus()
      set({ isGmailConnected: status.isConnected, gmailEmail: status.email })
    } catch {
      set({ isGmailConnected: false, gmailEmail: null, gmailError: 'Could not load Gmail status' })
    } finally {
      set({ isGmailLoading: false })
    }
  },

  connectGmail: async () => {
    set({ isGmailConnecting: true, gmailError: null })
    try {
      window.location.assign(await startGmailConnect())
    } catch (error) {
      set({
        gmailError: error instanceof Error ? error.message : 'Could not start Gmail connection',
      })
      set({ isGmailConnecting: false })
    }
  },

  disconnectGmail: async () => {
    set({ isGmailLoading: true, gmailError: null })
    try {
      await disconnectGmailAccount()
      set({ isGmailConnected: false, gmailEmail: null })
    } catch (error) {
      set({
        gmailError: error instanceof Error ? error.message : 'Could not disconnect Gmail',
      })
    } finally {
      set({ isGmailLoading: false })
    }
  },
}))
