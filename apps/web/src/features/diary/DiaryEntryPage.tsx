import { useEffect, useRef, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { ArrowLeft, Lock } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { DiaryEntry, Mood } from '../../global/stores/useDiaryStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { todayKey } from '../../global/lib/dates'
import { MOOD_META } from './DiaryPage'
import { DiaryRevealModal } from './DiaryRevealModal'
import { Button } from '../../global/ui/Button'
import { Card } from '../../global/ui/Card'
import { Field, Input } from '../../global/ui/Field'

const HAND_FONT = "'Segoe Print', 'Snell Roundhand', 'Segoe Script', 'Comic Sans MS', cursive"
const INK = '#33406B'

export function DiaryEntryPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const entries = useDiaryStore((state) => state.entries)
  const addEntry = useDiaryStore((state) => state.addEntry)
  const updateEntry = useDiaryStore((state) => state.updateEntry)

  const entry: DiaryEntry | null = id ? entries.find((item) => item.id === id) ?? null : null

  const minDate = entry ? undefined : format(startOfMonth(addMonths(new Date(), -1)), 'yyyy-MM-dd')
  const maxDate = entry ? undefined : todayKey()

  const [date, setDate] = useState(entry?.date ?? todayKey())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [mood, setMood] = useState<Mood>(entry?.mood ?? 'okay')
  const [content, setContent] = useState(entry?.content ?? '')
  const [tagsText, setTagsText] = useState(entry?.tags.join(', ') ?? '')
  const [hideEntry, setHideEntry] = useState(entry?.hidden ?? false)

  const contentRef = useRef<HTMLTextAreaElement>(null)

  const grow = () => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    grow()
  }, [entry?.id])

  const goBack = () => navigate('/diary')

  const handleSave = () => {
    if (!content.trim() && !title.trim()) return
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
    if (entry) {
      updateEntry(entry.id, { title: title.trim(), content: content.trim(), mood, tags, date, hidden: hideEntry })
    } else {
      addEntry({ title: title.trim(), content: content.trim(), mood, tags, date, hidden: hideEntry })
    }
    goBack()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
        >
          <ArrowLeft size={16} />
          Diary
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-(--text-muted)">
            <span>Date</span>
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text) outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
            />
          </label>
          <Button disabled={!content.trim() && !title.trim()} onClick={handleSave}>
            Save
          </Button>
        </div>
      </header>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mb-2 block text-xs font-medium text-(--text-muted)">Mood</span>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(MOOD_META) as Mood[]).map((m) => {
                const meta = MOOD_META[m]
                const selected = mood === m
                return (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    title={meta.label}
                    aria-pressed={selected}
                    className={`grid h-11 w-11 place-items-center rounded-xl border text-xl transition ${
                      selected
                        ? 'border-(--accent) bg-(--accent-soft) ring-2 ring-(--accent)/20'
                        : 'border-(--border) bg-(--surface) hover:border-(--border-strong) hover:bg-(--surface-2)'
                    }`}
                  >
                    <span>{meta.emoji}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hideEntry}
            onClick={() => setHideEntry((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm transition hover:border-(--border-strong) hover:bg-(--surface-2)"
          >
            <Lock size={14} className="text-(--accent)" />
            <span className="text-(--text)">Keep private</span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                hideEntry ? 'bg-(--accent)' : 'bg-(--surface-3)'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  hideEntry ? 'left-4.5' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </div>

        <div className="mt-4 border-t border-(--border) pt-4">
          <Field label="Tags" hint="Comma-separated — #focus, #win, #honest">
            <Input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="work, win"
            />
          </Field>
        </div>
      </Card>

      {hideEntry ? (
        <p className="mb-4 text-center text-xs text-(--text-muted)">
          Only visible with your account password — stays blurred on the dashboard.
        </p>
      ) : null}

      {id && !entry ? (
        <Card className="grid place-items-center gap-3 p-14 text-center">
          <p className="text-sm text-(--text-muted)">This entry isn’t loaded right now.</p>
          <Button variant="ghost" onClick={goBack}>
            Back to diary
          </Button>
        </Card>
      ) : (
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 translate-x-[4px] translate-y-[4px] border border-[#E3DCCC] bg-[#FAF7F0]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 translate-x-[8px] translate-y-[8px] border border-[#D9D1BE] bg-[#F3EFE4]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 translate-x-[12px] translate-y-[12px] border border-[#CFC6AF] bg-[#ECE7D8]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
          <div
            className="relative bg-[#F7F0E0]"
            style={{ boxShadow: '0 14px 30px -10px rgba(0,0,0,0.18), 0 4px 10px -4px rgba(0,0,0,0.10)' }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-[46px] w-[1.5px] bg-[#E39E92]"
            />
            <div className="relative">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                className="w-full bg-transparent px-16 pt-8 text-center text-3xl leading-[36px] outline-none placeholder:text-[#C4BBA6]"
                style={{ fontFamily: HAND_FONT, color: INK, backgroundColor: 'transparent' }}
              />
              <div
                aria-hidden
                className="h-[2px] w-full bg-[#E39E92]"
              />
              <div
                className="relative"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent 35px, #B7C4DA 35px, #B7C4DA 36px)',
                }}
              >
                <textarea
                  ref={contentRef}
                  autoFocus
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value)
                    grow()
                  }}
                  placeholder="No rules. Write it how it actually felt."
                  rows={12}
                  className="w-full resize-none bg-transparent pl-16 pr-8 pb-10 text-[19px] leading-[36px] outline-none scroll-thin placeholder:text-[#B7AE99]"
                  style={{
                    fontFamily: HAND_FONT,
                    color: INK,
                    minHeight: '55vh',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {entry && entry.hidden ? <DiaryRevealModal entryId={entry.id} onClose={goBack} /> : null}
    </div>
  )
}