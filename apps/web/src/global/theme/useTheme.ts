import { useEffect } from 'react'
import { useThemeStore } from '../stores/useThemeStore'

export function useTheme() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return { theme, setTheme }
}