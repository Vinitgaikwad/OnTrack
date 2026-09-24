import { useState } from 'react'
import Markdown from 'react-markdown'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const tabClass = (active: boolean) =>
  `rounded-lg px-3 py-1 text-xs font-medium transition ${
    active ? 'bg-(--surface) text-(--text) shadow-sm' : 'text-(--text-muted) hover:text-(--text)'
  }`

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')

  return (
    <div className="overflow-hidden rounded-xl border border-(--border) bg-(--surface) transition-all duration-200 focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent)/20">
      <div className="flex items-center justify-between border-b border-(--border) bg-(--surface-2) px-2 py-1.5">
        <div className="flex gap-1">
          <button type="button" className={tabClass(mode === 'write')} onClick={() => setMode('write')}>
            Write
          </button>
          <button type="button" className={tabClass(mode === 'preview')} onClick={() => setMode('preview')}>
            Preview
          </button>
        </div>
        <span className="pr-2 text-[11px] text-(--text-muted)">Markdown</span>
      </div>

      {mode === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          spellCheck={false}
          className="w-full resize-y scroll-thin bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed text-(--text) placeholder:text-(--text-muted) outline-none"
        />
      ) : (
        <div className="max-h-72 min-h-40 overflow-y-auto scroll-thin px-3 py-2.5">
          {value.trim() ? (
            <div className="markdown max-w-none">
              <Markdown>{value}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-(--text-muted)">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}