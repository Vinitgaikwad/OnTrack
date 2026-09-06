import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldProps = {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-(--text-muted)">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-(--text-muted)">{hint}</span> : null}
    </label>
  )
}

const control =
  'w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text) ' +
  'placeholder:text-(--text-muted) outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} resize-y scroll-thin ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} ${props.className ?? ''}`} />
}