import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, StickyNote, Bot, BookOpen, Timer, CalendarDays, LayoutDashboard } from 'lucide-react'
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

  return (
    <div className="flex min-h-screen flex-col bg-(--bg) text-(--text)">
      <Navbar />
      <div className="flex flex-1">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-(--border) bg-(--surface) p-4 scroll-thin md:flex lg:w-60">
          <div className="px-3 pb-2 pt-1 text-xs font-semibold tracking-widest text-(--text-muted)">
            Focus Hub
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-(--accent-soft) text-(--accent)'
                    : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text)'
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

        <nav className="sticky top-16 z-30 flex gap-1 overflow-x-auto border-b border-(--border) bg-(--surface) px-3 py-2 no-scrollbar md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-(--accent-soft) text-(--accent)'
                    : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text)'
                }`
              }
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <ToastHost />
    </div>
  )
}