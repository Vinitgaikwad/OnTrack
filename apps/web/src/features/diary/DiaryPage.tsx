import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format, parse } from 'date-fns'
import { BookOpen, CalendarDays, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import type { DiaryEntry, Mood } from '../../global/stores/useDiaryStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { DiaryEditor } from './DiaryEditor'
import { DiaryRevealModal } from './DiaryRevealModal'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'
import { IconButton } from '../../global/ui/IconButton'
import { Modal } from '../../global/ui/Modal'

export const MOOD_META: Record<Mood, { label: string; emoji: string; color: string }> = {
  great: { label: 'Great', emoji: '😄', color: 'var(--success)' },
  good: { label: 'Good', emoji: '🙂', color: 'var(--calendar)' },
  okay: { label: 'Okay', emoji: '😐', color: 'var(--notes)' },
  low: { label: 'Low', emoji: '😕', color: 'var(--danger)' },
  rough: { label: 'Rough', emoji: '😞', color: 'var(--danger)' },
}

const CURRENT_MONTH = format(new Date(), 'yyyy-MM')
const MONTH_SPAN = 24

function buildMonthOptions(entries: DiaryEntry[]): string[] {
  const newest = entries.reduce(
    (latest, entry) => (entry.date.slice(0, 7) > latest ? entry.date.slice(0, 7) : latest),
    '0000-00'
  )
  const end = newest > CURRENT_MONTH ? newest : CURRENT_MONTH
  const start = format(addMonths(parse(`${end}-01`, 'yyyy-MM-dd', new Date()), -(MONTH_SPAN - 1)), 'yyyy-MM')
  const options: string[] = []
  let cursor = start
  while (cursor <= end) {
    options.push(cursor)
    cursor = format(addMonths(parse(`${cursor}-01`, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM')
  }
  return options
}

export function DiaryPage() {
  const entries = useDiaryStore((state) => state.entries)
  const activeMonth = useDiaryStore((state) => state.activeMonth)
  const loadStatus = useDiaryStore((state) => state.loadStatus)
  const hasMore = useDiaryStore((state) => state.hasMore)
  const ensureLoaded = useDiaryStore((state) => state.ensureLoaded)
  const ensureMonth = useDiaryStore((state) => state.ensureMonth)
  const loadMore = useDiaryStore((state) => state.loadMore)
  const removeEntry = useDiaryStore((state) => state.removeEntry)

  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)
  const [revealId, setRevealId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DiaryEntry | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const monthOptions = useMemo(() => buildMonthOptions(entries), [entries])

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  useEffect(() => {
    if (activeMonth === null && loadStatus !== 'loading') {
      void ensureMonth(CURRENT_MONTH)
    }
  }, [activeMonth, loadStatus, ensureMonth])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: '240px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const selectedMonth = activeMonth ?? CURRENT_MONTH
  const monthEntries = entries.filter((entry) => entry.date.startsWith(selectedMonth))
  const loading = loadStatus === 'loading' || loadStatus === 'idle'
  const loaded = loadStatus === 'loaded'

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.hidden) {
      setRevealId(deleteTarget.id)
      setDeleteTarget(null)
      return
    }
    removeEntry(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diary</h1>
          <p className="text-sm text-(--text-muted)">
            Daily entries, or whenever you feel like it. Yours to keep.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-(--text-muted)">
            <CalendarDays size={14} />
            <select
              value={selectedMonth}
              onChange={(event) => void ensureMonth(event.target.value)}
              className="rounded-xl border border-(--border) bg-(--surface) px-3 py-1.5 text-sm text-(--text) outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy')}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} />
            New entry
          </Button>
        </div>
      </header>

      {loading && monthEntries.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-14 text-center">
          <Loader2 size={32} className="animate-spin text-(--text-muted)" />
          <p className="text-sm text-(--text-muted)">Loading your diary…</p>
        </Card>
      ) : monthEntries.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-14 text-center">
          <BookOpen size={40} className="text-(--text-muted)" />
          <p className="text-sm text-(--text-muted)">
            {loaded
              ? 'Nothing written this month. One honest sentence is a great start.'
              : 'Cannot reach the diary right now.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {monthEntries.map((entry) => {
            const mood = MOOD_META[entry.mood]

            if (entry.hidden) {
              return (
                <button
                  key={entry.id}
                  onClick={() => setRevealId(entry.id)}
                  className="group border border-(--border) rounded-2xl bg-(--surface) p-5 text-left shadow-sm transition hover:border-(--border-strong) hover:bg-(--surface-2)"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-(--text-muted)">
                    <Lock size={13} className="text-(--accent)" />
                    Hidden entry
                    <span className="ml-auto text-(--accent)">Tap to unlock</span>
                  </div>
                  <p className="mt-2 select-none text-sm blur-sm">{entry.content || entry.title || '…'}</p>
                </button>
              )
            }

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
                        <IconButton
                          icon={Trash2}
                          label="Delete entry"
                          onClick={() => setDeleteTarget(entry)}
                        />
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

          {hasMore ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div ref={sentinelRef} className="grid h-10 place-items-center">
                {loading ? <Loader2 size={18} className="animate-spin text-(--text-muted)" /> : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadMore()}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <DiaryEditor
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        open={editing !== null}
        initial={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />

      {revealId ? (
        <DiaryRevealModal entryId={revealId} onClose={() => setRevealId(null)} />
      ) : null}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete entry?"
        width="max-w-md"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-(--text-muted)">
            “{deleteTarget?.title || 'Untitled'}” will be permanently removed. This can’t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}