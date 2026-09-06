/// <reference types="vite/client" />

interface Window {
  ontrack?: {
    closeDashboard: () => void
    showDashboard: () => void
    isDashboardVisible: () => Promise<boolean>
    setDashboardAlwaysOnTop: (onTop: boolean) => void
    isDashboardAlwaysOnTop: () => Promise<boolean>
    showMain: () => void
  }
}