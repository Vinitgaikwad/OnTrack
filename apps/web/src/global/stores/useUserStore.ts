import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearSession, SESSION_EXPIRED_EVENT_NAME } from '../lib/session'
import {
  restoreUser,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
  type AppUser,
} from '../repositories/auth.repository'

export type AuthStatus = 'restoring' | 'signedIn' | 'signedOut'

export type UserStore = {
  user: AppUser | null
  status: AuthStatus
  restoreSession: () => Promise<void>
  signUp: (input: { email: string; name: string; password: string }) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: AppUser) => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      status: 'restoring',
      restoreSession: async () => {
        set({ status: 'restoring' })
        try {
          const user = await restoreUser()
          set({ user, status: 'signedIn' })
        } catch {
          set({ user: null, status: 'signedOut' })
        }
      },
      signUp: async (input) => {
        await signUpRequest(input)
        set({ user: null, status: 'signedOut' })
      },
      signIn: async (email, password) => {
        const session = await signInRequest(email, password)
        set({ user: session.user, status: 'signedIn' })
      },
      signOut: async () => {
        await signOutRequest()
        clearSession()
        set({ user: null, status: 'signedOut' })
      },
      setUser: (user) => set({ user }),
    }),
    { name: 'ontrack-user', partialize: (state) => ({ user: state.user }) }
  )
)

/**
 * Makes the store react to cross-window sign-outs and expired sessions
 * (e.g. refresh token rejected). Call once at startup.
 */
export function subscribeAuthEvents(): void {
  window.addEventListener(SESSION_EXPIRED_EVENT_NAME, () => {
    useUserStore.setState({ user: null, status: 'signedOut' })
  })
  window.addEventListener('storage', (event) => {
    if (event.key === 'ontrack-user') {
      const stored = localStorage.getItem('ontrack-user')
      const parsed = stored ? JSON.parse(stored).state : null
      useUserStore.setState({
        user: parsed?.user ?? null,
        // The value was just written by another window signing in/out, so the
        // stored user IS the current auth truth — don't keep a stale local status.
        status: parsed?.user ? 'signedIn' : 'signedOut',
      })
    }
  })
}