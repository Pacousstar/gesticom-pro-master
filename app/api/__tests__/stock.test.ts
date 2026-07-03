// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockStockFindMany = vi.hoisted(() => vi.fn())
const mockStockCount = vi.hoisted(() => vi.fn())
const mockStockFindUnique = vi.hoisted(() => vi.fn())
const mockStockFindFirst = vi.hoisted(() => vi.fn())
const mockStockCreate = vi.hoisted(() => vi.fn())
const mockStockUpdate = vi.hoisted(() => vi.fn())
const mockStockDelete = vi.hoisted(() => vi.fn())
const mockProduitFindMany = vi.hoisted(() => vi.fn())
const mockProduitFindUnique = vi.hoisted(() => vi.fn())
const mockProduitCount = vi.hoisted(() => vi.fn())
const mockProduitUpdate = vi.hoisted(() => vi.fn())
const mockMagasinFindUnique = vi.hoisted(() => vi.fn())
const mockMagasinFindFirst = vi.hoisted(() => vi.fn())
const mockMouvementCreate = vi.hoisted(() => vi.fn())
const mockMouvementFindFirst = vi.hoisted(() => vi.fn())
const mockUtilisateurFindUnique = vi.hoisted(() => vi.fn())

const mockTx = {
  mouvement: { findFirst: mockMouvementFindFirst, create: mockMouvementCreate },
  stock: { findUnique: mockStockFindUnique, create: mockStockCreate, update: mockStockUpdate, delete: mockStockDelete },
  produit: { update: mockProduitUpdate },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    stock: {
      findMany: mockStockFindMany,
      count: mockStockCount,
      findUnique: mockStockFindUnique,
      findFirst: mockStockFindFirst,
      create: mockStockCreate,
      update: mockStockUpdate,
      delete: mockStockDelete,
    },
    produit: {
      findMany: mockProduitFindMany,
      findUnique: mockProduitFindUnique,
      count: mockProduitCount,
      update: mockProduitUpdate,
    },
    magasin: {
      findUnique: mockMagasinFindUnique,
      findFirst: mockMagasinFindFirst,
    },
    mouvement: {
      create: mockMouvementCreate,
      findFirst: mockMouvementFindFirst,
    },
    utilisateur: {
      findUnique: mockUtilisateurFindUnique,
    },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
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
  logModification: vi.fn(),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserMouvementStock: vi.fn(),
}))

vi.mock('@/lib/calculs-commerciaux', () => ({
  nouveauPampApresAchatLigne: vi.fn().mockReturnValue(3500),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { GET } = await import('../stock/route')
const { POST: POST_ENTREE } = await import('../stock/entree/route')
const { POST: POST_SORTIE } = await import('../stock/sortie/route')
const { DELETE: DELETE_STOCK } = await import('../stock/[id]/route')

function mockReq(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/stock')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function mockDeleteReq(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    { json: vi.fn() } as unknown as NextRequest,
    { params: Promise.resolve({ id }) },
  ]
}

function makeStock(overrides = {}) {
  return {
    id: 1, produitId: 1, magasinId: 1, entiteId: 1,
    quantite: 100, quantiteInitiale: 100,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeProduit(overrides = {}) {
  return {
    id: 1, code: 'PROD-001', designation: 'Produit Test',
    categorie: 'GENERAL', seuilMin: 5, prixAchat: 3000,
    pamp: 3000, prixVente: 5000, prixMinimum: 2500,
    ...overrides,
  }
}

describe('GET /api/stock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée', async () => {
    mockStockFindMany.mockResolvedValue([makeStock({
      produit: { id: 1, code: 'PROD-001', designation: 'Produit Test', categorie: 'GENERAL', seuilMin: 5, prixAchat: 3000, prixVente: 5000, prixMinimum: 2500 },
      magasin: { id: 1, code: 'MAG-001', nom: 'Magasin Test' },
    })])
    mockStockCount.mockResolvedValue(1)

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].quantite).toBe(100)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.total).toBe(1)
  })

  it('filtre par magasinId', async () => {
    mockStockFindMany.mockResolvedValue([makeStock({
      magasinId: 2,
      produit: { id: 1, code: 'PROD-001', designation: 'Produit Test', categorie: 'GENERAL', seuilMin: 5, prixAchat: 3000, prixVente: 5000, prixMinimum: 2500 },
      magasin: { id: 2, code: 'MAG-002', nom: 'Second Magasin' },
    })])
    mockStockCount.mockResolvedValue(1)

    await GET(mockReq({ magasinId: '2' }))

    const [{ where }] = mockStockFindMany.mock.calls[0]
    expect(where.magasinId).toBe(2)
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)

    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })

  it('mode complet avec magasinId', async () => {
    mockProduitFindMany.mockResolvedValue([makeProduit()])
    mockStockFindMany.mockResolvedValue([{ id: 1, produitId: 1, quantite: 100, quantiteInitiale: 100, createdAt: new Date('2025-01-01') }])
    mockProduitCount.mockResolvedValue(1)
    mockMagasinFindUnique.mockResolvedValue({ id: 1, code: 'MAG-001', nom: 'Magasin Test' })

    const res = await GET(mockReq({ complet: '1', magasinId: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].quantite).toBe(100)
    expect(body[0].produit.code).toBe('PROD-001')
    expect(body[0].magasin.code).toBe('MAG-001')
    expect(mockStockCount).not.toHaveBeenCalled()
  })

  it('mode complet sans magasinId', async () => {
    mockProduitFindMany.mockResolvedValue([makeProduit()])
    mockStockFindMany.mockResolvedValue([{
      id: 1, produitId: 1, quantite: 100, quantiteInitiale: 100,
      createdAt: new Date('2025-01-01'),
      magasin: { id: 1, code: 'MAG-001', nom: 'Magasin Test' },
    }])
    mockProduitCount.mockResolvedValue(1)
    mockMagasinFindFirst.mockResolvedValue({ id: 1, code: 'MAG-001', nom: 'Magasin Test' })

    const res = await GET(mockReq({ complet: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].quantite).toBe(100)
  })

  it('retourne 404 si magasin introuvable en mode complet', async () => {
    mockProduitFindMany.mockResolvedValue([makeProduit()])
    mockStockFindMany.mockResolvedValue([])
    mockProduitCount.mockResolvedValue(1)
    mockMagasinFindUnique.mockResolvedValue(null)

    const res = await GET(mockReq({ complet: '1', magasinId: '999' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/stock/entree', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée une entrée de stock valide', async () => {
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockMagasinFindUnique.mockResolvedValue({ id: 1, code: 'MAG-001', nom: 'Magasin Test', entiteId: 1 })
    mockProduitFindUnique.mockResolvedValue({
      id: 1, code: 'PROD-001', designation: 'Produit Test',
      pamp: 3000, prixAchat: 3000,
      stocks: [{ id: 1, quantite: 100 }],
    })
    mockMouvementFindFirst.mockResolvedValue(null)
    mockMouvementCreate.mockResolvedValue({ id: 1 })
    mockStockFindUnique
      .mockResolvedValueOnce({ id: 1, quantite: 100 })
      .mockResolvedValueOnce({
        id: 1, quantite: 110,
        produit: { code: 'PROD-001', designation: 'Produit Test' },
        magasin: { code: 'MAG-001' },
      })

    const res = await POST_ENTREE(mockJson({
      magasinId: 1,
      produitId: 1,
      quantite: 10,
      observation: 'Réapprovisionnement',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quantite).toBe(110)
    expect(body.produit.code).toBe('PROD-001')
    expect(mockStockCreate).not.toHaveBeenCalled()
  })

  it('crée une entrée avec nouveau stock si inexistant', async () => {
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockMagasinFindUnique.mockResolvedValue({ id: 2, code: 'MAG-002', nom: 'Autre Magasin', entiteId: 1 })
    mockProduitFindUnique.mockResolvedValue({
      id: 2, code: 'PROD-002', designation: 'Nouveau Produit',
      pamp: 0, prixAchat: 2000,
      stocks: [],
    })
    mockMouvementFindFirst.mockResolvedValue(null)
    mockMouvementCreate.mockResolvedValue({ id: 1 })
    mockStockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 2, quantite: 15,
        produit: { code: 'PROD-002', designation: 'Nouveau Produit' },
        magasin: { code: 'MAG-002' },
      })
    mockStockCreate.mockResolvedValue({ id: 2, quantite: 0 })

    const res = await POST_ENTREE(mockJson({
      magasinId: 2,
      produitId: 2,
      quantite: 15,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quantite).toBe(15)
    expect(mockStockCreate).toHaveBeenCalled()
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)

    const res = await POST_ENTREE(mockJson({ magasinId: 1, produitId: 1, quantite: 10 }))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si données invalides', async () => {
    const res = await POST_ENTREE(mockJson({}))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si magasin ou produit introuvable', async () => {
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockMagasinFindUnique.mockResolvedValue(null)

    const res = await POST_ENTREE(mockJson({
      magasinId: 999,
      produitId: 1,
      quantite: 10,
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/stock/sortie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée une sortie de stock valide', async () => {
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockMagasinFindUnique.mockResolvedValue({ id: 1, code: 'MAG-001', nom: 'Magasin Test', entiteId: 1 })
    mockProduitFindUnique.mockResolvedValue({ id: 1, code: 'PROD-001' })
    mockStockFindUnique
      .mockResolvedValueOnce({ id: 1, quantite: 100 })
      .mockResolvedValueOnce({
        id: 1, quantite: 80,
        produit: { code: 'PROD-001', designation: 'Produit Test' },
        magasin: { code: 'MAG-001' },
      })
    mockMouvementFindFirst.mockResolvedValue(null)
    mockMouvementCreate.mockResolvedValue({ id: 1 })

    const res = await POST_SORTIE(mockJson({
      magasinId: 1,
      produitId: 1,
      quantite: 20,
      observation: 'Vente client',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quantite).toBe(80)
    expect(body.produit.code).toBe('PROD-001')
  })

  it('retourne 400 si stock insuffisant', async () => {
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockMagasinFindUnique.mockResolvedValue({ id: 1, code: 'MAG-001', nom: 'Magasin Test', entiteId: 1 })
    mockProduitFindUnique.mockResolvedValue({ id: 1, code: 'PROD-001' })
    mockStockFindUnique.mockResolvedValueOnce({ id: 1, quantite: 10 })

    const res = await POST_SORTIE(mockJson({
      magasinId: 1,
      produitId: 1,
      quantite: 50,
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Stock insuffisant')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)

    const res = await POST_SORTIE(mockJson({ magasinId: 1, produitId: 1, quantite: 10 }))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si données invalides', async () => {
    const res = await POST_SORTIE(mockJson({}))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/stock/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('supprime une ligne de stock', async () => {
    mockStockFindFirst.mockResolvedValue({ id: 1, produitId: 1, magasinId: 1, quantite: 100 })
    mockStockDelete.mockResolvedValue({ id: 1 })
    mockMouvementCreate.mockResolvedValue({ id: 1 })

    const res = await DELETE_STOCK(...mockDeleteReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.id).toBe(1)
    expect(mockStockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('retourne 404 si introuvable', async () => {
    mockStockFindFirst.mockResolvedValue(null)

    const res = await DELETE_STOCK(...mockDeleteReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)

    const res = await DELETE_STOCK(...mockDeleteReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    const res = await DELETE_STOCK(...mockDeleteReq('abc'))
    expect(res.status).toBe(400)
  })
})
