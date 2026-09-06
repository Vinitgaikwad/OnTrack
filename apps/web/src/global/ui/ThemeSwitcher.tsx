import { useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { THEMES } from '../theme/themes'
import { useTheme } from '../theme/useTheme'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const current = THEMES.find((meta) => meta.id === theme) ?? THEMES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-(--border) px-2.5 py-1.5 text-sm text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex -space-x-1">
          {current.swatches.slice(0, 3).map((color) => (
            <span
              key={color}
              className="h-4 w-4 rounded-full border-2 border-(--surface)"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span className="hidden sm:block">{current.label}</span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-(--border) bg-(--surface) p-2 shadow-xl"
          >
            <p className="px-3 py-2 text-xs font-medium text-(--text-muted)">Appearance</p>
            {THEMES.map((meta) => (
              <button
                key={meta.id}
                role="option"
                aria-selected={meta.id === theme}
                onClick={() => {
                  setTheme(meta.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-(--surface-2)"
              >
                <span className="flex -space-x-1">
                  {meta.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-5 w-5 rounded-full border-2 border-(--surface)"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-(--text)">{meta.label}</span>
                  <span className="block text-xs text-(--text-muted)">{meta.tagline}</span>
                </span>
                {meta.id === theme ? <Check size={16} className="text-(--accent)" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function ThemePreviewSwatches(): ReactNode {
  const { theme } = useTheme()
  const meta = THEMES.find((item) => item.id === theme) ?? THEMES[0]
  return (
    <div className="flex items-center gap-2">
      {meta.swatches.map((color) => (
        <span key={color} className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}