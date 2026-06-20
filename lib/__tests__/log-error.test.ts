import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logError, apiCatch } from '../log-error'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('logError', () => {
  it('appelle fetch POST /api/errors/log avec le message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    await logError('Test error')
    expect(mockFetch).toHaveBeenCalledWith('/api/errors/log', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message).toBe('Test error')
    expect(body.level).toBe('error')
  })

  it('passe les options a fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    await logError('Warning', { level: 'warning', source: 'test', component: 'TestComponent' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.level).toBe('warning')
    expect(body.source).toBe('test')
    expect(body.component).toBe('TestComponent')
  })

  it('ne rejette pas si fetch echoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    await expect(logError('Silent fail')).resolves.toBeUndefined()
  })
})

describe('apiCatch', () => {
  it('logge une Error avec sa stack', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    const err = new Error('Message test')
    await apiCatch(err, 'api/test')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message).toBe('Message test')
    expect(body.source).toBe('api/test')
    expect(body.stack).toBe(err.stack)
    expect(body.level).toBe('error')
  })

  it('logge une valeur non-Error avec message par defaut', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    await apiCatch('simple string', 'api/test')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message).toBe('Erreur inconnue')
    expect(body.stack).toBeUndefined()
  })

  it('ne rejette jamais', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch fail')))
    await expect(apiCatch('whatever', 'test')).resolves.toBeUndefined()
  })
})
