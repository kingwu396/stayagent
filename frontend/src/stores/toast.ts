import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: Toast[]
  add: (type: ToastType, message: string) => void
  remove: (id: string) => void
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 3000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  add: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => {
      const next = [...s.toasts, { id, type, message }]
      // 最多 3 条，超出丢掉最老的
      return { toasts: next.slice(-MAX_TOASTS) }
    })
    // 自动消失
    setTimeout(() => get().remove(id), AUTO_DISMISS_MS)
  },

  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
