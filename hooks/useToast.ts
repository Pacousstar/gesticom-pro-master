'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { Toast, ToastType } from '@/components/ui/Toast'

let toasts: Toast[] = []
const listeners = new Set<() => void>()

function getSnapshot() {
  return toasts
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function emit() {
  listeners.forEach((cb) => cb())
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, type, message, duration }
    toasts = [...toasts, newToast]
    emit()
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    return showToast('success', message, duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number) => {
    return showToast('error', message, duration ?? 7000)
  }, [showToast])

  const warning = useCallback((message: string, duration?: number) => {
    return showToast('warning', message, duration)
  }, [showToast])

  const info = useCallback((message: string, duration?: number) => {
    return showToast('info', message, duration)
  }, [showToast])

  return {
    toasts: currentToasts,
    success,
    error,
    warning,
    info,
    removeToast,
  }
}
