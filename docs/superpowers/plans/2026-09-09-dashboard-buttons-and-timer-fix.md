# Dashboard Controls & Timer Reset Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add open main app, pin, and close buttons to the dashboard when user is not signed in, and fix timer persistence so it resets after session completes and reminders are dismissed.

**Architecture:** Extract the dashboard header into a shared component used by both signed-in and signed-out states. Add a `resetIfFinished` action to the timer store that auto-fires when the last reminder is dismissed.

**Tech Stack:** React 19, Zustand, Tailwind v4, Lucide icons, Electron IPC

**Spec:** N/A — user request

---

## File Map

| File | Change |
|---|---|
| `apps/web/src/features/dashboard/DashboardHeader.tsx` | **Create** — shared header with pin/open/close controls |
| `apps/web/src/features/dashboard/DashboardWindow.tsx` | **Modify** — use DashboardHeader in signed-out state |
| `apps/web/src/features/dashboard/DashboardPage.tsx` | **Modify** — replace inline header with DashboardHeader |
| `apps/web/src/global/stores/useTimerStore.ts` | **Modify** — add `resetIfFinished` action, call it from `dismissReminder` |

---

### Task 1: Extract DashboardHeader component

**Files:**
- Create: `apps/web/src/features/dashboard/DashboardHeader.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx:68-114`

**Interfaces:**
- Consumes: `isOnTop` boolean, `toggleOnTop` callback, `onOpenApp` callback, `onClose` callback
- Produces: `<DashboardHeader>` component used by DashboardPage and DashboardWindow

- [ ] **Step 1: Create DashboardHeader.tsx**

```tsx
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Pin, Sparkles, X } from 'lucide-react'

type DashboardHeaderProps = {
  onOpenApp?: () => void
  onClose?: () => void
}

export function DashboardHeader({ onOpenApp, onClose }: DashboardHeaderProps) {
  const [isOnTop, setIsOnTop] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.ontrack
      ?.isDashboardAlwaysOnTop()
      .then((onTop) => {
        if (!cancelled) setIsOnTop(onTop)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggleOnTop = () => {
    if (!window.ontrack) return
    const next = !isOnTop
    window.ontrack.setDashboardAlwaysOnTop(next)
    setIsOnTop(next)
  }

  return (
    <header className="mb-2 flex select-none items-center gap-2 [-webkit-app-region:drag]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-(--accent) text-white">
        <Sparkles size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-bold tracking-tight">OnTrack</p>
        <p className="text-[11px] text-(--text-muted)">{format(new Date(), 'EEE, MMM d')}</p>
      </div>
      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        <button
          onClick={toggleOnTop}
          title={isOnTop ? 'Always on top (on)' : 'Always on top (off)'}
          aria-label={isOnTop ? 'Turn off always on top' : 'Turn on always on top'}
          aria-pressed={isOnTop}
          className={`grid h-7 w-7 place-items-center rounded-lg transition ${
            isOnTop
              ? 'bg-(--accent-soft) text-(--accent)'
              : 'text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text)'
          }`}
        >
          <Pin size={14} className={isOnTop ? '' : 'rotate-45'} />
        </button>
        {onOpenApp ? (
          <button
            onClick={onOpenApp}
            title="Open OnTrack"
            aria-label="Open OnTrack"
            className="grid h-7 w-7 place-items-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
          >
            <ExternalLink size={14} />
          </button>
        ) : null}
        {onClose ? (
          <button
            onClick={onClose}
            title="Hide dashboard"
            aria-label="Hide dashboard"
            className="grid h-7 w-7 place-items-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update DashboardPage to use DashboardHeader**

Replace the inline header block (lines 68-114) with:

```tsx
if (isWidget) {
  return (
    <div className="min-h-screen">
      <DashboardHeader onOpenApp={onOpenApp} onClose={onClose} />
      {/* ... rest of widget content unchanged ... */}
    </div>
  )
}
```

Remove the `isOnTop`/`toggleOnTop` state and effects from DashboardPage (they now live in DashboardHeader).

- [ ] **Step 3: Verify build**

Run: `npm run build -w web`
Expected: No errors

---

### Task 2: Add header to signed-out dashboard state

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardWindow.tsx`

**Interfaces:**
- Consumes: `DashboardHeader` from Task 1
- Produces: Dashboard with header controls visible when not signed in

- [ ] **Step 1: Update DashboardWindow.tsx**

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w web`
Expected: No errors

---

### Task 3: Fix timer reset when last reminder is dismissed

**Files:**
- Modify: `apps/web/src/global/stores/useTimerStore.ts:132-133`

**Interfaces:**
- Consumes: existing `dismissReminder` and `reset` actions
- Produces: timer auto-resets to idle when last reminder is dismissed while in finished state

- [ ] **Step 1: Update dismissReminder in useTimerStore.ts**

Replace the `dismissReminder` action (line 132-133):

```ts
dismissReminder: (id) => {
  const next = get().reminders.filter((r) => r.id !== id)
  set({ reminders: next })
  if (next.length === 0 && get().status === 'finished') {
    set({ status: 'idle', endAt: null, remainingMs: TOTAL_MS(get().minutes) })
  }
},
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w web`
Expected: No errors

---

### Task 4: Verify end-to-end

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Manual verification checklist**

1. Open dashboard while signed out → header with pin/open/close buttons visible
2. Click "Open OnTrack" → main window opens
3. Click close (X) → dashboard hides
4. Click pin → toggles always-on-top visual state
5. Sign in → dashboard shows widgets with same header controls
6. Start timer → let it finish → dismiss all reminders → timer resets to idle
7. Timer state does not persist as "finished" after all reminders dismissed
