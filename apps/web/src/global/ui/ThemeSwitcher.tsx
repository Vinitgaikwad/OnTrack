import { useState, useRef, useEffect } from 'react'
import { Check, Palette } from 'lucide-react'
import { THEMES } from '../theme/themes'
import { useTheme } from '../theme/useTheme'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const current = THEMES.find((meta) => meta.id === theme) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface) px-2.5 py-1.5 text-sm text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Palette size={15} />
        <span className="hidden sm:block">{current.emoji}</span>
        <span className="hidden sm:block font-medium">{current.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-(--border) bg-(--surface) p-2 shadow-xl"
          >
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              Appearance
            </p>
            <div className="grid grid-cols-2 gap-2 px-1 pb-1">
              {THEMES.map((meta) => (
                <button
                  key={meta.id}
                  role="option"
                  aria-selected={meta.id === theme}
                  onClick={() => {
                    setTheme(meta.id)
                    setOpen(false)
                  }}
                  className={`group relative flex flex-col items-center gap-2.5 rounded-xl border-2 px-3 py-4 text-center transition ${
                    meta.id === theme
                      ? 'border-(--accent) bg-(--accent-soft)'
                      : 'border-transparent hover:border-(--border) hover:bg-(--surface-2)'
                  }`}
                >
                  {meta.id === theme && (
                    <span className="absolute top-2 right-2">
                      <Check size={14} className="text-(--accent)" />
                    </span>
                  )}
                  <span className="text-xl">{meta.emoji}</span>
                  <div>
                    <span className="block text-sm font-semibold text-(--text)">
                      {meta.label}
                    </span>
                    <span className="block text-[11px] text-(--text-muted)">
                      {meta.tagline}
                    </span>
                  </div>
                  <span className="flex -space-x-1">
                    {meta.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-3.5 w-3.5 rounded-full border-2 border-(--surface) transition group-hover:scale-110"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ThemePreviewSwatches() {
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
