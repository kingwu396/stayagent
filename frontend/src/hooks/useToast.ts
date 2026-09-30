import { useToastStore } from '@/stores/toast'

export function useToast() {
  const add = useToastStore((s) => s.add)
  return {
    success: (msg: string) => add('success', msg),
    error: (msg: string) => add('error', msg),
    info: (msg: string) => add('info', msg),
    warning: (msg: string) => add('warning', msg),
  }
}
