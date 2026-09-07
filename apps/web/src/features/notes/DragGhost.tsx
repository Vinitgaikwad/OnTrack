import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NoteTask } from '../../global/stores/useNotesStore'
import { NoteCardVisual } from './SortableNoteCard'

type Point = { x: number; y: number }

export function DragGhost({ task }: { task: NoteTask }) {
  const [position, setPosition] = useState<Point | null>(null)
  const offsetRef = useRef<Point | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const sourceRect = document.querySelector(`[data-task-id="${task.id}"]`)?.getBoundingClientRect()
    if (!sourceRect) return
    offsetRef.current = null
    setPosition({ x: sourceRect.left, y: sourceRect.top })

    const onPointerMove = (event: PointerEvent) => {
      if (!offsetRef.current) {
        const rect = document.querySelector(`[data-task-id="${task.id}"]`)?.getBoundingClientRect()
        if (!rect) return
        offsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }
      const offset = offsetRef.current
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: event.clientX - offset.x, y: event.clientY - offset.y })
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [task.id])

  if (!position) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-50"
      data-ghost="true"
      style={{ left: position.x, top: position.y }}
    >
      <NoteCardVisual task={task} overlay />
    </div>,
    document.body
  )
}