'use client'

import { useEffect } from 'react'

export default function ErrorInitializer() {
  useEffect(() => {
    function sendError(error: unknown, source: string) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      try {
        fetch('/api/errors/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            stack,
            source,
            url: window.location.href,
            level: 'error',
          }),
        })
      } catch {}
    }

    const origOnError = window.onerror
    window.onerror = function (msg, url, line, col, error) {
      sendError(error || new Error(String(msg)), 'window.onerror')
      if (origOnError) return origOnError.call(window, msg, url, line, col, error)
      return false
    }

    const origOnRejection = window.onunhandledrejection
    window.onunhandledrejection = function (e) {
      sendError(e.reason || new Error('Promise rejetée'), 'unhandledrejection')
      if (origOnRejection) return origOnRejection.call(window, e)
    }

    return () => {
      window.onerror = origOnError
      window.onunhandledrejection = origOnRejection
    }
  }, [])

  return null
}
