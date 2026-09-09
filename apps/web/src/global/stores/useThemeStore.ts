import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '../theme/themes'

type ThemeState = {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'fun',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ontrack-theme' }
  )
)