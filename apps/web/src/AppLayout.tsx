import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, StickyNote, Bot, BookOpen, Timer, CalendarDays, LayoutDashboard, Sparkles } from 'lucide-react'
import { Navbar } from './global/layout/Navbar'
import { ToastHost } from './global/ui/ToastHost'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Today', icon: Home },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/diary', label: 'Diary', icon: BookOpen },
  { to: '/timer', label: 'Timer', icon: Timer },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
] as const

export function AppLayout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  const closeNav = () => setNavOpen(false)

  return (
    <div className="flex min-h-screen flex-col bg-(--bg) text-(--text)">
      <Navbar menuOpen={navOpen} onToggleMenu={() => setNavOpen((value) => !value)} />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-(--border) bg-(--surface) p-4 scroll-thin md:flex lg:w-60">
          <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">
            Focus Hub
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-(--accent-soft) text-(--accent) shadow-sm'
                    : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text) active:scale-[0.98]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <div className="mt-auto px-3 pt-4 text-[11px] leading-relaxed text-(--text-muted)">
            Built for brains that wander. Get back to the page.
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {navOpen ? (
        <>
          <div
            className="fixed inset-0 z-[35] bg-black/40 backdrop-blur-sm md:hidden"
            onClick={closeNav}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 overflow-y-auto border-r border-(--border) bg-(--surface) p-4 shadow-2xl scroll-thin md:hidden"
          >
            <div className="flex items-center gap-2.5 px-2 pb-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-(--accent) text-white shadow-sm">
                <Sparkles size={18} />
              </span>
              <span className="text-lg font-bold tracking-tight">OnTrack</span>
            </div>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeNav}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-(--accent-soft) text-(--accent) shadow-sm'
                      : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text) active:scale-[0.98]'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
            <div className="mt-auto px-2 pt-4 text-[11px] leading-relaxed text-(--text-muted)">
              Built for brains that wander. Get back to the page.
            </div>
          </div>
        </>
      ) : null}

      <ToastHost />
    </div>
  )
}
