import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
}

export function IconButton({ icon: Icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-xl text-(--text-muted) transition-all duration-200 hover:bg-(--surface-2) hover:text-(--text) active:scale-90 ${className}`}
      {...props}
    >
      <Icon size={18} />
    </button>
  )
}
