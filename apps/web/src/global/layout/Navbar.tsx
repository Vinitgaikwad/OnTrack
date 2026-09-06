import { useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { HelpCircle, LogOut, Settings, Sparkles } from 'lucide-react'
import { ThemeSwitcher } from '../ui/ThemeSwitcher'
import { useUserStore } from '../stores/useUserStore'

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const FALLBACK_PROFILE = {
  name: 'Vinit',
  email: 'vinit@ontrack.app',
  initials: 'VN',
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const user = useUserStore((state) => state.user)
  const signOut = useUserStore((state) => state.signOut)

  const profile = user
    ? { name: user.name, email: user.email, initials: initialsFor(user.name) }
    : FALLBACK_PROFILE

  const closeAll = () => {
    setOpen(false)
    setHelpOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-(--border) bg-(--surface) px-3 py-3 sm:gap-4 sm:px-6">
      <NavLink to="/" onClick={closeAll} className="flex shrink-0 items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-(--accent) text-white shadow-sm">
          <Sparkles size={18} />
        </span>
        <span className="hidden text-lg font-bold tracking-tight sm:block">OnTrack</span>
      </NavLink>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemeSwitcher />

        <div className="relative">
          <button
            onClick={() => setHelpOpen((value) => !value)}
            aria-label="Help"
            className="grid h-9 w-9 place-items-center rounded-xl text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
          >
            <HelpCircle size={18} />
          </button>
          {helpOpen ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setHelpOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-(--border) bg-(--surface) p-2 shadow-xl">
                <p className="px-3 py-2 text-xs font-medium text-(--text-muted)">Help</p>
                <button
                  onClick={() => {
                    closeAll()
                    navigate('/calendar')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                >
                  <Settings size={16} className="text-(--text-muted)" />
                  Get oriented in Calendar
                </button>
                <button
                  onClick={() => {
                    closeAll()
                    navigate('/timer')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                >
                  <HelpCircle size={16} className="text-(--text-muted)" />
                  Try a timer session
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-(--surface-2)"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-(--accent-soft) text-sm font-semibold text-(--accent)">
              {profile.initials}
            </span>
          </button>
          {open ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-(--border) bg-(--surface) p-2 shadow-xl"
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-(--accent-soft) text-sm font-semibold text-(--accent)">
                    {profile.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-(--text)">{profile.name}</span>
                    <span className="block text-xs text-(--text-muted)">{profile.email}</span>
                  </span>
                </div>
                <div className="my-1 h-px bg-(--border)" />
                <button
                  role="menuitem"
                  disabled
                  title="Profile is not set up yet — coming soon"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text-muted) opacity-60"
                >
                  <Settings size={16} />
                  Profile settings
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    closeAll()
                    void signOut().then(() => navigate('/sign-in'))
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-(--text) transition hover:bg-(--surface-2)"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}