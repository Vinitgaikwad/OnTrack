import { Sparkles } from 'lucide-react'
import { DashboardPage } from './DashboardPage'
import { DashboardHeader } from './DashboardHeader'
import { useUserStore } from '../../global/stores/useUserStore'
import { useTheme } from '../../global/theme/useTheme'
import { Button } from '../../global/ui/Button'

export function DashboardWindow() {
  useTheme()
  const status = useUserStore((state) => state.status)

  const handleClose = () => window.ontrack?.closeDashboard()
  const handleOpenApp = () => window.ontrack?.showMain()

  return (
    <div className="widget-window min-h-screen bg-(--bg) p-2 text-(--text)">
      {status === 'signedIn' ? (
        <DashboardPage
          isWidget
          onClose={handleClose}
          onOpenApp={handleOpenApp}
        />
      ) : status === 'restoring' ? (
        <div className="flex min-h-[calc(100vh-1rem)] flex-col items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--accent) text-white shadow-sm">
            <Sparkles size={20} />
          </span>
          <span className="text-sm text-(--text-muted)">Checking your session…</span>
        </div>
      ) : (
        <div className="flex min-h-[calc(100vh-1rem)] flex-col gap-2">
          <DashboardHeader onOpenApp={handleOpenApp} onClose={handleClose} />
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <Sparkles size={20} />
            </span>
            <p className="text-sm font-medium">
              Sign in to see your dashboard here
            </p>
            <p className="max-w-52 text-xs text-(--text-muted)">
              Your wedges stay private until you&apos;re signed in.
            </p>
            <Button size="sm" onClick={handleOpenApp}>
              Open OnTrack to sign in
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}