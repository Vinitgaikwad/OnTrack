import { useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { Lock } from 'lucide-react'
import type { DiaryEntry, Mood } from '../../global/stores/useDiaryStore'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { MOOD_META } from './DiaryPage'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input, Textarea } from '../../global/ui/Field'
import { todayKey } from '../../global/lib/dates'

type DiaryEditorProps = {
  open: boolean
  initial: DiaryEntry | null
  onClose: () => void
}

export function DiaryEditor({ open, initial, onClose }: DiaryEditorProps) {
  const addEntry = useDiaryStore((state) => state.addEntry)
  const updateEntry = useDiaryStore((state) => state.updateEntry)

  // New entries may be back-dated no further than the previous month; edits keep the original date.
  const minDate = initial ? undefined : format(startOfMonth(addMonths(new Date(), -1)), 'yyyy-MM-dd')
  const maxDate = initial ? undefined : todayKey()

  const [date, setDate] = useState(initial?.date ?? todayKey())
  const [title, setTitle] = useState(initial?.title ?? '')
  const [mood, setMood] = useState<Mood>(initial?.mood ?? 'okay')
  const [content, setContent] = useState(initial?.content ?? '')
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '')
  const [hideEntry, setHideEntry] = useState(initial?.hidden ?? false)

  const handleSave = () => {
    if (!content.trim() && !title.trim()) return
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
    if (initial) {
      updateEntry(initial.id, { title: title.trim(), content: content.trim(), mood, tags, date, hidden: hideEntry })
    } else {
      addEntry({ title: title.trim(), content: content.trim(), mood, tags, date, hidden: hideEntry })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit entry' : 'New diary entry'}>
      <div className="flex flex-col gap-5">
        <Field label="Date">
          <Input
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <div>
          <span className="mb-2 block text-xs font-medium text-(--text-muted)">
            How was your day?
          </span>
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
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition ${
                    selected
                      ? 'scale-[1.04] border-(--accent) bg-(--accent-soft) ring-2 ring-(--accent)/20'
                      : 'border-(--border) bg-(--surface) hover:border-(--border-strong) hover:bg-(--surface-2)'
                  }`}
                >
                  <span className="text-xl leading-none">{meta.emoji}</span>
                  <span
                    className={`text-[10px] font-medium ${
                      selected ? 'text-(--accent)' : 'text-(--text-muted)'
                    }`}
                  >
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Title" hint="Optional — a word or two is enough.">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Today was…" />
        </Field>

        <Field label="What happened?">
          <Textarea
            autoFocus
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder="No rules. Write it how it actually felt."
            className="min-h-36 leading-relaxed"
          />
        </Field>

        <Field label="Tags" hint="Comma-separated — #focus, #win, #honest">
          <Input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="work, win"
          />
        </Field>

        <button
          type="button"
          role="switch"
          aria-checked={hideEntry}
          onClick={() => setHideEntry((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm transition hover:border-(--border-strong) hover:bg-(--surface-2)"
        >
          <span className="flex items-center gap-2 text-(--text)">
            <Lock size={14} className="text-(--accent)" />
            Keep this private
          </span>
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
        {hideEntry ? (
          <p className="text-xs text-(--text-muted)">
            Only visible with your account password — stays blurred on the dashboard.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-(--border) pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!content.trim() && !title.trim()} onClick={handleSave}>
            {initial ? 'Save changes' : 'Save entry'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}