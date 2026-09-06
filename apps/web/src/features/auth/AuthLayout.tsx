import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-(--bg) px-4 text-(--text)">
      <NavLink to="/" className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--accent) text-white shadow-sm">
          <Sparkles size={20} />
        </span>
        <span className="text-xl font-bold tracking-tight">OnTrack</span>
      </NavLink>
      <div className="w-full max-w-sm">{children}</div>
      <p className="max-w-xs text-center text-xs text-(--text-muted)">
        Built for brains that wander. Get back to the page.
      </p>
    </div>
  )
}