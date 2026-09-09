import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-(--border) bg-(--surface) shadow-sm transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
