import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  TASK_EVENT_COLOR,
  useCalendarStore,
  type Appointment,
} from '../../global/stores/useCalendarStore'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'

type TaskModalProps = {
  open: boolean
  date: string
  appointment: Appointment | null
  onClose: () => void
}

export function TaskModal({ open, date, appointment, onClose }: TaskModalProps) {
  const addAppointment = useCalendarStore((state) => state.addAppointment)
  const updateAppointment = useCalendarStore((state) => state.updateAppointment)
  const removeAppointment = useCalendarStore((state) => state.removeAppointment)

  const [title, setTitle] = useState(appointment?.title ?? '')
  const [dueDate, setDueDate] = useState(appointment?.date ?? date)

  const handleSave = () => {
    if (!title.trim()) return
    const payload = {
      kind: 'task' as const,
      title: title.trim(),
      date: dueDate,
      startTime: '',
      endTime: null,
      color: TASK_EVENT_COLOR,
      notes: '',
    }
    if (appointment) {
      updateAppointment(appointment.id, payload)
    } else {
      addAppointment(payload)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={appointment ? 'Edit task' : 'New task'}>
      <div className="flex flex-col gap-4">
        <Field label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Send the proposal"
          />
        </Field>

        <Field label="Date">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => {
              if (event.target.value) setDueDate(event.target.value)
            }}
          />
        </Field>

        <div className="flex items-center justify-between gap-2 pt-1">
          {appointment ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                removeAppointment(appointment.id)
                onClose()
              }}
            >
              <Trash2 size={14} />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!title.trim()} onClick={handleSave}>
              {appointment ? 'Save changes' : 'Add task'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}