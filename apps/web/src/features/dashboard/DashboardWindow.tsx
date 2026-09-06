import { DashboardPage } from './DashboardPage'
import { useTheme } from '../../global/theme/useTheme'

export function DashboardWindow() {
  useTheme()

  return (
    <div className="widget-window min-h-screen bg-(--bg) p-2 text-(--text)">
      <DashboardPage
        isWidget
        onClose={() => window.ontrack?.closeDashboard()}
        onOpenApp={() => window.ontrack?.showMain()}
      />
    </div>
  )
}