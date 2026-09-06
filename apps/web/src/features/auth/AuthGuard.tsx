import { Navigate, Outlet } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useUserStore } from '../../global/stores/useUserStore'

export function AuthGuard() {
  const status = useUserStore((state) => state.status)

  if (status === 'restoring') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-(--bg) text-(--text)">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--accent) text-white shadow-sm">
          <Sparkles size={20} />
        </span>
        <span className="text-sm text-(--text-muted)">Checking your session…</span>
      </div>
    )
  }

  if (status === 'signedOut') return <Navigate to="/sign-in" replace />

  return <Outlet />
}