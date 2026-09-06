import { create } from 'zustand'
import { uid } from '../lib/id'

export type ToastLevel = 'info' | 'warn' | 'error'

export type Toast = {
  id: string
  title: string
  message?: string
  level: ToastLevel
}

type ToastStore = {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = uid()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 6000)
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))