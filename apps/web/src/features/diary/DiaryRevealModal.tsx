import { useState } from 'react'
import { Lock } from 'lucide-react'
import { toErrorMessage } from '../../global/lib/api'
import { useDiaryStore } from '../../global/stores/useDiaryStore'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { Modal } from '../../global/ui/Modal'

type DiaryRevealModalProps = {
  entryId: string
  onClose: () => void
}

export function DiaryRevealModal({ entryId, onClose }: DiaryRevealModalProps) {
  const reveal = useDiaryStore((state) => state.reveal)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleUnlock = async () => {
    if (!password.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await reveal(entryId, password)
      onClose()
    } catch (err) {
      setError(toErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Hidden entry">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-(--surface-2) p-3 text-sm text-(--text-muted)">
          <Lock size={18} className="mt-0.5 shrink-0 text-(--accent)" />
          <p>
            This entry is locked. Enter your account password to reveal it — unlocking it also
            makes it visible here and everywhere else. You can hide it again later from the editor.
          </p>
        </div>
        <Field label="Account password">
          <Input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleUnlock()
            }}
            placeholder="••••••••"
          />
        </Field>
        {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-(--border) pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!password.trim() || busy} onClick={handleUnlock}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}