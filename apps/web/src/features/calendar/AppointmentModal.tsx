import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  EVENT_COLORS,
  useCalendarStore,
  type Appointment,
  type CalendarEventKind,
} from '../../global/stores/useCalendarStore'
import { Modal } from '../../global/ui/Modal'
import { Button } from '../../global/ui/Button'
import { Field, Input, Textarea } from '../../global/ui/Field'

type AppointmentModalProps = {
  open: boolean
  date: string
  kind?: CalendarEventKind
  appointment: Appointment | null
  onClose: () => void
}

export function AppointmentModal({ open, date, kind = 'appointment', appointment, onClose }: AppointmentModalProps) {
  const addAppointment = useCalendarStore((state) => state.addAppointment)
  const updateAppointment = useCalendarStore((state) => state.updateAppointment)
  const removeAppointment = useCalendarStore((state) => state.removeAppointment)

  const isBirthday = (appointment?.kind ?? kind) === 'birthday'

  const [title, setTitle] = useState(appointment?.title ?? '')
  const [startTime, setStartTime] = useState(isBirthday ? '' : appointment?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(appointment?.endTime ?? '')
  const [color, setColor] = useState(appointment?.color ?? EVENT_COLORS[0].value)
  const [notes, setNotes] = useState(appointment?.notes ?? '')

  const handleSave = () => {
    if (!title.trim()) return
    const payload = {
      kind: isBirthday ? 'birthday' as const : 'appointment' as const,
      title: title.trim(),
      date,
      startTime: isBirthday ? '' : startTime,
      endTime: isBirthday ? null : endTime || null,
      color,
      notes: notes.trim(),
    }
    if (appointment) {
      updateAppointment(appointment.id, payload)
    } else {
      addAppointment(payload)
    }
    onClose()
  }

  const modalTitle = isBirthday
    ? appointment
      ? 'Edit birthday'
      : 'New birthday'
    : appointment
      ? 'Edit appointment'
      : 'New appointment'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
    >
      <div className="flex flex-col gap-4">
        <Field label={isBirthday ? 'Name' : 'Title'}>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isBirthday ? "e.g. Mom's birthday" : 'Therapy call'}
          />
        </Field>

        {!isBirthday ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </Field>
            <Field label="Ends" hint="Optional">
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </Field>
          </div>
        ) : (
          <p className="text-xs text-(--text-muted)">All day — no time needed.</p>
        )}

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {EVENT_COLORS.map((option) => (
              <button
                key={option.value}
                onClick={() => setColor(option.value)}
                title={option.name}
                className={`h-7 w-7 rounded-full transition ${
                  color === option.value ? 'ring-2 ring-(--accent) ring-offset-2 ring-offset-(--surface)' : ''
                }`}
                style={{ backgroundColor: option.value }}
              />
            ))}
          </div>
        </Field>

        <Field label={isBirthday ? 'Extra note' : 'Notes'} hint="Optional context for the day.">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Bring a gift, don't be late…"
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
              {appointment ? 'Save changes' : isBirthday ? 'Add birthday' : 'Add appointment'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}