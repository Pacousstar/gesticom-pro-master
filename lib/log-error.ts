export async function logError(
  message: string,
  options?: {
    source?: string
    component?: string
    stack?: string
    context?: Record<string, unknown>
    level?: 'error' | 'warning' | 'info'
    userAction?: string
  }
) {
  try {
    await fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack: options?.stack,
        source: options?.source || 'app',
        component: options?.component,
        context: options?.context,
        level: options?.level || 'error',
        userAction: options?.userAction,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    })
  } catch {}
}

export async function apiCatch(error: unknown, source: string): Promise<void> {
  const message = error instanceof Error ? error.message : 'Erreur inconnue'
  await logError(message, {
    source,
    stack: error instanceof Error ? error.stack : undefined,
    level: 'error',
  })
}
