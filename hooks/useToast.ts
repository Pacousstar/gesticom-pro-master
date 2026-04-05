'use client'

import { useState, useCallback } from 'react'
import type { Toast, ToastType } from '@/components/ui/Toast'

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = {
      id,
      type,
      message,
      duration,
    }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    return showToast('success', message, duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number) => {
    return showToast('error', message, duration ?? 7000) // Erreurs restent plus longtemps
  }, [showToast])

  const warning = useCallback((message: string, duration?: number) => {
    return showToast('warning', message, duration)
  }, [showToast])

  const info = useCallback((message: string, duration?: number) => {
    return showToast('info', message, duration)
  }, [showToast])

  return {
    toasts,
    success,
    error,
    warning,
    info,
    removeToast,
  }
}
