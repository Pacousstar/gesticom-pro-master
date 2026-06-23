import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCaisseFindMany = vi.hoisted(() => vi.fn())
const mockParamFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    caisse: { findMany: mockCaisseFindMany },
    parametre: { findFirst: mockParamFindFirst },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN' }),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: vi.fn().mockResolvedValue(1),
}))

const { GET: GET_PDF } = await import('../caisse/export-pdf/route')
const { GET: GET_EXCEL } = await import('../caisse/export-excel/route')

function mockReq(params: Record<string, string> = {}): any {
  const url = new URL('http://localhost/api/caisse/export')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url } as any
}

function makeOperation(overrides = {}) {
  return {
    id: 1, date: new Date('2026-06-01'),
    type: 'ENTREE', montant: 50000,
    motif: 'Dépôt espèces',
    magasin: { code: 'MAG01', nom: 'Magasin' },
    utilisateur: { nom: 'Admin' },
    ...overrides,
  }
}

describe('GET /api/caisse/export-pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET_PDF(mockReq())
    expect(res.status).toBe(401)
  })

  it('retourne un PDF avec données', async () => {
    mockCaisseFindMany.mockResolvedValue([makeOperation()])

    const res = await GET_PDF(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('filtre par type', async () => {
    mockCaisseFindMany.mockResolvedValue([])

    await GET_PDF(mockReq({ type: 'ENTREE' }))

    const [{ where }] = mockCaisseFindMany.mock.calls[0]
    expect(where.type).toBe('ENTREE')
  })

  it('filtre par magasinId', async () => {
    mockCaisseFindMany.mockResolvedValue([])

    await GET_PDF(mockReq({ magasinId: '1' }))

    const [{ where }] = mockCaisseFindMany.mock.calls[0]
    expect(where.magasinId).toBe(1)
  })

  it('retourne un PDF avec 0 opérations', async () => {
    mockCaisseFindMany.mockResolvedValue([])

    const res = await GET_PDF(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })
})

describe('GET /api/caisse/export-excel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET_EXCEL(mockReq())
    expect(res.status).toBe(401)
  })

  it('retourne un Excel avec données', async () => {
    mockCaisseFindMany.mockResolvedValue([makeOperation()])

    const res = await GET_EXCEL(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
  })

  it('retourne un Excel avec 0 opérations', async () => {
    mockCaisseFindMany.mockResolvedValue([])

    const res = await GET_EXCEL(mockReq())
    expect(res.status).toBe(200)
  })

  it('filtre par date', async () => {
    mockCaisseFindMany.mockResolvedValue([])

    await GET_EXCEL(mockReq({ dateDebut: '2026-01-01', dateFin: '2026-06-30', magasinId: '1', type: 'SORTIE' }))

    const [{ where }] = mockCaisseFindMany.mock.calls[0]
    expect(where.date.gte).toBeDefined()
    expect(where.date.lte).toBeDefined()
    expect(where.magasinId).toBe(1)
    expect(where.type).toBe('SORTIE')
  })
})
