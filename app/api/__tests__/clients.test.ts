// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockClientFindMany = vi.hoisted(() => vi.fn())
const mockClientCount = vi.hoisted(() => vi.fn())
const mockClientCreate = vi.hoisted(() => vi.fn())
const mockVenteGroupBy = vi.hoisted(() => vi.fn())
const mockReglementVenteGroupBy = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    client: {
      findMany: mockClientFindMany,
      count: mockClientCount,
      create: mockClientCreate,
    },
    vente: { groupBy: mockVenteGroupBy },
    reglementVente: { groupBy: mockReglementVenteGroupBy },
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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function mockNextRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/clients')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

const { GET, POST } = await import('../clients/route')

function makeClient(overrides = {}) {
  return {
    id: 1, code: '000001A', nom: 'Client Test', telephone: '612345678',
    type: 'CASH', plafondCredit: null, ncc: null, localisation: null,
    soldeInitial: 0, avoirInitial: 0, pointsFidelite: 0, actif: true,
    ...overrides,
  }
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

describe('GET /api/clients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée de clients', async () => {
    const clients = [makeClient(), makeClient({ id: 2, code: '000002B', nom: 'Client Deux' })]
    mockClientCount.mockResolvedValue(2)
    mockClientFindMany.mockResolvedValue(clients)
    mockVenteGroupBy.mockResolvedValue([])
    mockReglementVenteGroupBy.mockResolvedValue([])

    const res = await GET(mockNextRequest({ page: '1', limit: '20' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(2)
    expect(data.pagination.total).toBe(2)
  })

  it('filtre par recherche q', async () => {
    mockClientCount.mockResolvedValue(1)
    mockClientFindMany.mockResolvedValue([makeClient()])
    mockVenteGroupBy.mockResolvedValue([])
    mockReglementVenteGroupBy.mockResolvedValue([])

    await GET(mockNextRequest({ q: 'Test' }))

    const [{ where }] = mockClientFindMany.mock.calls[0]
    expect(where.OR[0].nom.contains).toBe('Test')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockNextRequest())
    expect(res.status).toBe(401)
  })

  it('calcule la dette correctement', async () => {
    mockClientCount.mockResolvedValue(1)
    mockClientFindMany.mockResolvedValue([makeClient({ soldeInitial: 10000, avoirInitial: 2000 })])
    mockVenteGroupBy.mockResolvedValue([{ clientId: 1, _sum: { montantTotal: 50000 } }])
    mockReglementVenteGroupBy.mockResolvedValue([{ clientId: 1, _sum: { montant: 30000 } }])

    const res = await GET(mockNextRequest())
    const body = await res.json()
    expect(body.data[0].dette).toBe(28000)
  })
})

describe('POST /api/clients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée un client CASH', async () => {
    mockClientCount.mockResolvedValue(0)
    mockClientCreate.mockResolvedValue(makeClient())

    const res = await POST(mockJson({ nom: 'Nouveau Client', type: 'CASH' }))

    expect(res.status).toBe(200)
    expect(mockClientCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nom: 'Nouveau Client', type: 'CASH' }),
      })
    )
  })

  it('crée un client CREDIT avec plafond', async () => {
    mockClientCount.mockResolvedValue(0)
    mockClientCreate.mockResolvedValue(makeClient({ type: 'CREDIT', plafondCredit: 500000 }))

    const res = await POST(mockJson({ nom: 'Credit', type: 'CREDIT', plafondCredit: 500000 }))
    expect(res.status).toBe(200)
  })

  it('rejette un client CREDIT sans plafond', async () => {
    const res = await POST(mockJson({ nom: 'Credit', type: 'CREDIT' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('plafond')
  })

  it('rejette un client sans nom', async () => {
    const res = await POST(mockJson({ type: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('génère un code automatique', async () => {
    mockClientCount.mockResolvedValue(5)
    mockClientCreate.mockResolvedValue(makeClient())

    await POST(mockJson({ nom: 'Alpha', type: 'CASH' }))

    expect(mockClientCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: '000006A' }),
      })
    )
  })
})
