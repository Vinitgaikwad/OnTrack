import { useEffect } from 'react'
import { BookOpen, Lock } from 'lucide-react'
import { MOOD_META } from '../../diary/DiaryPage'
import { useDiaryStore } from '../../../global/stores/useDiaryStore'
import { WidgetCard } from './WidgetCard'

type DiaryWidgetProps = {
  onRemove?: () => void
  compact?: boolean
}

export function DiaryWidget({ onRemove, compact = false }: DiaryWidgetProps) {
  const latest = useDiaryStore((state) => state.entries[0])
  const ensureLoaded = useDiaryStore((state) => state.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  return (
    <WidgetCard title="Diary" icon={<BookOpen size={15} />} onRemove={onRemove} compact={compact}>
      {latest ? (
        latest.hidden ? (
          <p className="flex items-center gap-1.5 text-sm text-(--text-muted)">
            <Lock size={13} className="text-(--accent)" />
            Hidden entry
          </p>
        ) : (
          <>
            <p className={compact ? 'text-base' : 'text-lg'}>{MOOD_META[latest.mood].emoji}</p>
            <p className={`mt-0.5 text-sm text-(--text-muted) ${compact ? 'line-clamp-2' : 'line-clamp-2'}`}>
              {latest.content}
            </p>
          </>
        )
      ) : (
        <p className="text-sm text-(--text-muted)">No entry yet. Write one sentence today.</p>
      )}
    </WidgetCard>
  )
}