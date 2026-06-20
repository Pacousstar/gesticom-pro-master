// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

const mockCaisseFindMany = vi.hoisted(() => vi.fn())
const mockCaisseCount = vi.hoisted(() => vi.fn())
const mockCaisseGroupBy = vi.hoisted(() => vi.fn())
const mockCaisseFindUnique = vi.hoisted(() => vi.fn())
const mockCaisseDelete = vi.hoisted(() => vi.fn())
const mockMagasinFindUnique = vi.hoisted(() => vi.fn())
const mockVenteFindFirst = vi.hoisted(() => vi.fn())
const mockAchatFindFirst = vi.hoisted(() => vi.fn())
const mockEnregistrerMouvementCaisse = vi.hoisted(() => vi.fn())
const mockRecalculerSoldeCaisse = vi.hoisted(() => vi.fn())
const mockComptabiliserCaisse = vi.hoisted(() => vi.fn())
const mockValidateApiRequest = vi.hoisted(() => vi.fn())
const mockVerifierCloture = vi.hoisted(() => vi.fn())
const mockDeleteEcrituresByReference = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    caisse: {
      findMany: mockCaisseFindMany,
      count: mockCaisseCount,
      groupBy: mockCaisseGroupBy,
      findUnique: mockCaisseFindUnique,
      delete: mockCaisseDelete,
    },
    magasin: { findUnique: mockMagasinFindUnique },
    vente: { findFirst: mockVenteFindFirst },
    achat: { findFirst: mockAchatFindFirst },
    $transaction: vi.fn((cb: any) => cb({
      caisse: {
        findUnique: mockCaisseFindUnique,
        delete: mockCaisseDelete,
      },
    })),
    utilisateur: {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
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

vi.mock('@/lib/audit', () => ({
  logCreation: vi.fn(),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: mockEnregistrerMouvementCaisse,
  recalculerSoldeCaisse: mockRecalculerSoldeCaisse,
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserCaisse: mockComptabiliserCaisse,
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: mockValidateApiRequest,
}))

vi.mock('@/lib/cloture', () => ({
  verifierCloture: mockVerifierCloture,
}))

vi.mock('@/lib/delete-ecritures', () => ({
  deleteEcrituresByReference: mockDeleteEcrituresByReference,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { GET, POST } = await import('../caisse/route')
const { DELETE } = await import('../caisse/[id]/route')

function mockReq(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/caisse')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function makeOperation(overrides = {}) {
  return {
    id: 1,
    type: 'ENTREE',
    motif: 'Test',
    montant: 10000,
    magasinId: 1,
    utilisateurId: 1,
    date: new Date(),
    createdAt: new Date(),
    magasin: { id: 1, code: 'MAG-001', nom: 'Magasin Test' },
    utilisateur: { nom: 'Admin', login: 'admin' },
    ...overrides,
  }
}

describe('GET /api/caisse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée avec stats', async () => {
    mockCaisseFindMany.mockResolvedValue([makeOperation()])
    mockCaisseCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5)
    mockCaisseGroupBy.mockResolvedValue([
      { type: 'ENTREE', _sum: { montant: 10000 } },
      { type: 'SORTIE', _sum: { montant: 3000 } },
    ])

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.totalGlobal).toBe(5)
    expect(body.stats.totalEntrees).toBe(10000)
    expect(body.stats.totalSorties).toBe(3000)
    expect(body.stats.solde).toBe(7000)
  })

  it('filtre par type', async () => {
    mockCaisseFindMany.mockResolvedValue([makeOperation({ type: 'ENTREE' })])
    mockCaisseCount.mockResolvedValue(1)
    mockCaisseGroupBy.mockResolvedValue([
      { type: 'ENTREE', _sum: { montant: 10000 } },
    ])

    await GET(mockReq({ type: 'ENTREE' }))

    const [{ where }] = mockCaisseFindMany.mock.calls[0]
    expect(where.type).toBe('ENTREE')
  })

  it('filtre par recherche', async () => {
    mockCaisseFindMany.mockResolvedValue([])
    mockCaisseCount.mockResolvedValue(0)
    mockCaisseGroupBy.mockResolvedValue([])

    await GET(mockReq({ search: 'test' }))

    const [{ where }] = mockCaisseFindMany.mock.calls[0]
    expect(where.OR[0].motif.contains).toBe('test')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)

    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })
})

describe('POST /api/caisse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée une opération ENTREE', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: {
        magasinId: 1,
        type: 'ENTREE',
        motif: 'Dépôt client',
        montant: 50000,
        sousType: 'VENTE',
      },
    })
    mockMagasinFindUnique.mockResolvedValue({ id: 1, entiteId: 1 })
    mockEnregistrerMouvementCaisse.mockResolvedValue({ id: 1 })
    mockComptabiliserCaisse.mockResolvedValue(undefined)
    mockRecalculerSoldeCaisse.mockResolvedValue(undefined)
    mockCaisseFindUnique.mockResolvedValue(makeOperation({
      type: 'ENTREE',
      motif: 'Dépôt client',
      montant: 50000,
    }))

    const res = await POST(mockJson({
      magasinId: 1,
      type: 'ENTREE',
      motif: 'Dépôt client',
      montant: 50000,
      sousType: 'VENTE',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.type).toBe('ENTREE')
    expect(body.montant).toBe(50000)
    expect(mockEnregistrerMouvementCaisse).toHaveBeenCalled()
    expect(mockComptabiliserCaisse).toHaveBeenCalled()
    expect(mockRecalculerSoldeCaisse).toHaveBeenCalled()
  })

  it('crée une opération SORTIE', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: {
        magasinId: 1,
        type: 'SORTIE',
        motif: 'Paiement fournisseur',
        montant: 25000,
        sousType: 'ACHAT',
      },
    })
    mockMagasinFindUnique.mockResolvedValue({ id: 1, entiteId: 1 })
    mockEnregistrerMouvementCaisse.mockResolvedValue({ id: 2 })
    mockComptabiliserCaisse.mockResolvedValue(undefined)
    mockRecalculerSoldeCaisse.mockResolvedValue(undefined)
    mockCaisseFindUnique.mockResolvedValue(makeOperation({
      id: 2,
      type: 'SORTIE',
      motif: 'Paiement fournisseur',
      montant: 25000,
    }))

    const res = await POST(mockJson({
      magasinId: 1,
      type: 'SORTIE',
      motif: 'Paiement fournisseur',
      montant: 25000,
      sousType: 'ACHAT',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.type).toBe('SORTIE')
    expect(body.montant).toBe(25000)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: false,
      response: NextResponse.json({ error: 'Validation échouée' }, { status: 400 }),
    })

    const res = await POST(mockJson({}))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si magasin introuvable', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: {
        magasinId: 999,
        type: 'ENTREE',
        motif: 'Test',
        montant: 1000,
      },
    })
    mockMagasinFindUnique.mockResolvedValue(null)

    const res = await POST(mockJson({
      magasinId: 999,
      type: 'ENTREE',
      motif: 'Test',
      montant: 1000,
    }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/caisse/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('supprime une opération existante', async () => {
    mockCaisseFindUnique.mockResolvedValueOnce({ id: 1, magasinId: 1, date: new Date(), motif: 'Test' })
    mockCaisseDelete.mockResolvedValue({ id: 1 })
    mockDeleteEcrituresByReference.mockResolvedValue(undefined)
    mockRecalculerSoldeCaisse.mockResolvedValue(undefined)

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockCaisseDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockDeleteEcrituresByReference).toHaveBeenCalledWith('CAISSE', 1, expect.anything())
    expect(mockRecalculerSoldeCaisse).toHaveBeenCalledWith(1, expect.anything())
  })

  it('retourne 404 si opération introuvable', async () => {
    mockCaisseFindUnique.mockResolvedValue(null)

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Opération caisse introuvable.')
  })

  it('retourne 400 si id invalide', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})
