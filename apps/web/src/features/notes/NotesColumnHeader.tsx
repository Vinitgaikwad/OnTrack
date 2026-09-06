type NotesColumnHeaderProps = {
  title: string
  accent: string
  hint: string
  count: number
}

export function NotesColumnHeader({ title, accent, hint, count }: NotesColumnHeaderProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-1 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ color: accent, backgroundColor: 'color-mix(in srgb, ' + accent + ' 14%, transparent)' }}
      >
        {count}
      </span>
      <span className="ml-auto text-[11px] text-(--text-muted)">{hint}</span>
    </div>
  )
}