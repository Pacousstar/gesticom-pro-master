// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVenteFindMany = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    vente: { findMany: mockVenteFindMany },
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

const { GET } = await import('../ventes/export/route')

function mockReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/ventes/export')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url } as any
}

function makeVente(overrides = {}) {
  return {
    id: 1, numero: 'V20250001', numeroBon: null,
    date: new Date('2026-06-01'),
    montantTotal: 15000, montantPaye: 15000,
    modePaiement: 'ESPECES', statutPaiement: 'PAYE', statut: 'VALIDEE',
    client: { code: 'CL001', nom: 'Client Test' },
    clientLibre: null,
    magasin: { code: 'MAG01' },
    lignes: [{ produit: { designation: 'Produit A' } }],
    ...overrides,
  }
}

describe('GET /api/ventes/export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })

  it('retourne un Excel avec le bon Content-Type', async () => {
    mockVenteFindMany.mockResolvedValue([makeVente()])

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(res.headers.get('Content-Disposition')).toContain('.xlsx')
  })

  it('filtre par date', async () => {
    mockVenteFindMany.mockResolvedValue([])

    await GET(mockReq({ dateDebut: '2026-01-01', dateFin: '2026-06-30' }))

    const [{ where }] = mockVenteFindMany.mock.calls[0]
    expect(where.date.gte).toBeDefined()
    expect(where.date.lte).toBeDefined()
  })

  it('filtre par recherche textuelle', async () => {
    mockVenteFindMany.mockResolvedValue([
      makeVente({ numero: 'V20250001', client: { code: 'CL001', nom: 'Client Test' } }),
      makeVente({ id: 2, numero: 'V20250002', client: { code: 'CL002', nom: 'Autre Client' } }),
    ])

    const res = await GET(mockReq({ search: 'CL001' }))
    expect(res.status).toBe(200)
  })

  it('retourne un Excel même avec 0 ventes', async () => {
    mockVenteFindMany.mockResolvedValue([])

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
  })
})
