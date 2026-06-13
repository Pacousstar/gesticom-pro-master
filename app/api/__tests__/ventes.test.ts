// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockVenteFindMany = vi.hoisted(() => vi.fn())
const mockVenteCount = vi.hoisted(() => vi.fn())
const mockVenteAggregate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    vente: {
      findMany: mockVenteFindMany,
      count: mockVenteCount,
      aggregate: mockVenteAggregate,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1,
  }),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: vi.fn().mockResolvedValue(1),
  getEntiteIdOrAll: vi.fn().mockResolvedValue(null),
}))

const { GET } = await import('../ventes/route')

function mockReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/ventes')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function makeVente(overrides = {}) {
  return {
    id: 1, numero: 'V20250001', date: new Date().toISOString(),
    montantTotal: 15000, montantPaye: 15000, statutPaiement: 'PAYE',
    modePaiement: 'ESPECES', estVenteRapide: false,
    magasin: { code: 'MAG01', nom: 'Magasin Principal' },
    client: null, clientLibre: null,
    lignes: [], reglements: [], ReglementVenteLigne: [],
    ...overrides,
  }
}

describe('GET /api/ventes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée', async () => {
    mockVenteCount.mockResolvedValue(1)
    mockVenteFindMany.mockResolvedValue([makeVente()])
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 15000, montantPaye: 15000 },
    })

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.totals.montantTotal).toBe(15000)
  })

  it('filtre par date', async () => {
    mockVenteCount.mockResolvedValue(0)
    mockVenteFindMany.mockResolvedValue([])
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, montantPaye: 0 },
    })

    await GET(mockReq({ dateDebut: '2026-01-01', dateFin: '2026-01-31' }))

    const [{ where }] = mockVenteFindMany.mock.calls[0]
    expect(where.date.gte).toBeDefined()
    expect(where.date.lte).toBeDefined()
  })

  it('filtre par numéro', async () => {
    mockVenteCount.mockResolvedValue(0)
    mockVenteFindMany.mockResolvedValue([])
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, montantPaye: 0 },
    })

    await GET(mockReq({ numero: 'V2025' }))

    const [{ where }] = mockVenteFindMany.mock.calls[0]
    expect(where.numero.contains).toBe('V2025')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })
})
