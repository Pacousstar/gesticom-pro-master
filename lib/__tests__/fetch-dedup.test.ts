import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

describe('dedupFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appelle fetch pour une requête GET', async () => {
    mockFetch.mockResolvedValue(new Response('{"data":"ok"}'))
    const { dedupFetch } = await import('@/lib/fetch-dedup')
    await dedupFetch('/api/test')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('dédouble une requête GET identique', async () => {
    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      return Promise.resolve(new Response('{"data":"ok"}'))
    })
    const { dedupFetch } = await import('@/lib/fetch-dedup')
    await Promise.all([
      dedupFetch('/api/test'),
      dedupFetch('/api/test'),
    ])
    expect(callCount).toBe(1)
  })

  it('ne dédouble pas une requête POST', async () => {
    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      return Promise.resolve(new Response('{}'))
    })
    const { dedupFetch } = await import('@/lib/fetch-dedup')
    await Promise.all([
      dedupFetch('/api/test', { method: 'POST' }),
      dedupFetch('/api/test', { method: 'POST' }),
    ])
    expect(callCount).toBe(2)
  })
})
