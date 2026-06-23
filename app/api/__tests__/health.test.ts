import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryRaw = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne healthy quand la DB répond', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }])

    const { GET } = await import('@/app/api/health/route')
    const res = await GET()
    const data = await res.json()

    expect(data.status).toBe('healthy')
    expect(res.status).toBe(200)
    expect(data.version).toBeTruthy()
    expect(data.uptime).toBeGreaterThanOrEqual(0)
    expect(data.checks.database).toBe('ok')
  })

  it('retourne degraded quand la DB échoue', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB down'))

    const { GET } = await import('@/app/api/health/route')
    const res = await GET()
    const data = await res.json()

    expect(data.status).toBe('degraded')
    expect(res.status).toBe(503)
    expect(data.checks.database).toBe('error')
  })
})
