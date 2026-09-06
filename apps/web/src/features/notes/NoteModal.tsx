import { useState } from 'react'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input, Select, Textarea } from '../../global/ui/Field'
import type { NoteTask, TaskPriority } from '../../global/stores/useNotesStore'
import { useNotesStore } from '../../global/stores/useNotesStore'
import { todayKey } from '../../global/lib/dates'

type NoteModalProps = {
  open: boolean
  onClose: () => void
  task: NoteTask | null
}

export function NoteModal({ open, onClose, task }: NoteModalProps) {
  const addTask = useNotesStore((state) => state.addTask)
  const updateTask = useNotesStore((state) => state.updateTask)

  const [title, setTitle] = useState(task?.title ?? '')
  const [text, setText] = useState(task?.text ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState<string>(task?.dueDate ?? todayKey())

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit note' : 'New note'}>
      <div className="flex flex-col gap-4">
        <Field label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={'e.g. Reply to that email'}
          />
        </Field>
        <Field label="Details" hint="Keep it light — one line is plenty.">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What’s the one thing to remember?"
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              if (!title.trim()) return
              if (task) {
                updateTask(task.id, {
                  title: title.trim(),
                  text: text.trim(),
                  priority,
                  dueDate: dueDate || null,
                })
              } else {
                addTask({
                  title: title.trim(),
                  text: text.trim(),
                  priority,
                  dueDate: dueDate || null,
                })
              }
              onClose()
            }}
          >
            {task ? 'Save changes' : 'Add note'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}