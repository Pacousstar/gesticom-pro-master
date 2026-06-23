import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNextResponse = {
  next: vi.fn(() => ({
    headers: new Map<string, string>(),
    status: 200,
    statusText: 'OK',
  })),
  json: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
    headers: new Map<string, string>(),
    json: async () => body,
  })),
}

vi.mock('next/server', () => ({
  NextResponse: mockNextResponse,
  NextRequest: class MockNextRequest {},
}))

function createRequest(pathname: string, ip?: string) {
  const headers = new Map<string, string>()
  if (ip) headers.set('x-forwarded-for', ip)
  return {
    nextUrl: { pathname },
    headers: {
      get: (name: string) => headers.get(name) ?? null,
    },
  }
}

describe('middleware (rate limiting & headers)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockNextResponse.next.mockReturnValue({
      headers: new Map<string, string>(),
      status: 200,
      statusText: 'OK',
    } as any)
  })

  it('ne bloque pas /api/health', async () => {
    const mod = await import('@/middleware')
    const req = createRequest('/api/health')
    const res = mod.middleware(req as any)
    expect(res.status).toBe(200)
  })

  it('ajoute les headers de sécurité', async () => {
    const mod = await import('@/middleware')
    const req = createRequest('/api/produits')
    mod.middleware(req as any)
    const headers = mockNextResponse.next.mock.results[0].value.headers as Map<string, string>
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('bloque après 60 requêtes rapides (rate limit)', async () => {
    vi.stubGlobal('Date', {
      now: vi.fn(() => 1000),
    })

    const mod = await import('@/middleware')
    const req = createRequest('/api/produits', '10.0.0.1')

    let lastRes: any
    for (let i = 0; i < 61; i++) {
      lastRes = mod.middleware(req as any)
    }

    expect(lastRes.status).toBe(429)

    vi.unstubAllGlobals()
  })
})
