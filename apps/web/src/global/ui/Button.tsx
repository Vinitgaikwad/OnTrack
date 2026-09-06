import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-(--accent) ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none'

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-(--accent) text-white hover:opacity-90 active:scale-[0.98] shadow-sm',
  soft: 'bg-(--accent-soft) text-(--accent) hover:brightness-95 active:scale-[0.98]',
  ghost: 'text-(--text-muted) hover:text-(--text) hover:bg-(--surface-2) active:scale-[0.98]',
  danger: 'bg-(--danger) text-white hover:opacity-90 active:scale-[0.98]',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  )
}