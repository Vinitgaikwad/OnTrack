import { useState } from 'react'
import { format } from 'date-fns'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { DiaryEntry, Mood } from '../../global/stores/useDiaryStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { DiaryEditor } from './DiaryEditor'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'
import { IconButton } from '../../global/ui/IconButton'

export const MOOD_META: Record<Mood, { label: string; emoji: string; color: string }> = {
  great: { label: 'Great', emoji: '😄', color: 'var(--success)' },
  good: { label: 'Good', emoji: '🙂', color: 'var(--calendar)' },
  okay: { label: 'Okay', emoji: '😐', color: 'var(--notes)' },
  low: { label: 'Low', emoji: '😕', color: 'var(--danger)' },
  rough: { label: 'Rough', emoji: '😞', color: 'var(--danger)' },
}

export function DiaryPage() {
  const entries = useDiaryStore((state) => state.entries)
  const removeEntry = useDiaryStore((state) => state.removeEntry)
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diary</h1>
          <p className="text-sm text-(--text-muted)">
            Daily entries, or whenever you feel like it. Yours to keep.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          New entry
        </Button>
      </header>

      {entries.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-14 text-center">
          <BookOpen size={40} className="text-(--text-muted)" />
          <p className="text-sm text-(--text-muted)">
            Nothing written yet. One honest sentence is a great start.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
            const mood = MOOD_META[entry.mood]
            return (
              <Card key={entry.id} className="group p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" title={mood.label}>
                    {mood.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{entry.title || 'Untitled'}</h2>
                        <p className="text-xs text-(--text-muted)">
                          {format(new Date(entry.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <IconButton icon={Pencil} label="Edit entry" onClick={() => setEditing(entry)} />
                        <IconButton icon={Trash2} label="Delete entry" onClick={() => removeEntry(entry.id)} />
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{entry.content}</p>
                    {entry.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-(--surface-2) px-2 py-0.5 text-[11px] font-medium text-(--text-muted)"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <DiaryEditor
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        open={editing !== null}
        initial={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}