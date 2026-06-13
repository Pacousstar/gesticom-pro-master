// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockAchatFindMany = vi.hoisted(() => vi.fn())
const mockAchatCount = vi.hoisted(() => vi.fn())
const mockAchatAggregate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    achat: {
      findMany: mockAchatFindMany,
      count: mockAchatCount,
      aggregate: mockAchatAggregate,
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

const { GET } = await import('../achats/route')

function mockReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/achats')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function makeAchat(overrides = {}) {
  return {
    id: 1, numero: 'A20250001', date: new Date().toISOString(),
    montantTotal: 30000, montantPaye: 30000, statutPaiement: 'PAYE',
    modePaiement: 'ESPECES',
    fournisseur: null, fournisseurLibre: 'Fournisseur A',
    lignes: [], reglements: [], ReglementAchatLigne: [],
    magasin: { code: 'MAG01', nom: 'Principal' },
    ...overrides,
  }
}

describe('GET /api/achats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée', async () => {
    mockAchatCount.mockResolvedValue(1)
    mockAchatFindMany.mockResolvedValue([makeAchat()])
    mockAchatAggregate.mockResolvedValue({
      _sum: { montantTotal: 30000, montantPaye: 30000 },
    })

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.totals.montantTotal).toBe(30000)
  })

  it('filtre par fournisseur', async () => {
    mockAchatCount.mockResolvedValue(0)
    mockAchatFindMany.mockResolvedValue([])
    mockAchatAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, montantPaye: 0 },
    })

    await GET(mockReq({ fournisseurSearch: 'Fournisseur' }))

    const [{ where }] = mockAchatFindMany.mock.calls[0]
    expect(where.OR[0]['fournisseur'].nom.contains).toBe('Fournisseur')
  })

  it('filtre par numéro', async () => {
    mockAchatCount.mockResolvedValue(0)
    mockAchatFindMany.mockResolvedValue([])
    mockAchatAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, montantPaye: 0 },
    })

    await GET(mockReq({ numero: 'A2025' }))

    const [{ where }] = mockAchatFindMany.mock.calls[0]
    expect(where.numero.contains).toBe('A2025')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })
})
