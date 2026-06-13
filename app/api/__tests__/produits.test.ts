// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockProduitFindMany = vi.hoisted(() => vi.fn())
const mockProduitFindFirst = vi.hoisted(() => vi.fn())
const mockProduitCount = vi.hoisted(() => vi.fn())
const mockProduitCreate = vi.hoisted(() => vi.fn())
const mockStockCreate = vi.hoisted(() => vi.fn())
const mockMouvementCreate = vi.hoisted(() => vi.fn())
const mockMagasinFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    produit: {
      findMany: mockProduitFindMany,
      findFirst: mockProduitFindFirst,
      count: mockProduitCount,
      create: mockProduitCreate,
    },
    stock: { create: mockStockCreate },
    mouvement: { create: mockMouvementCreate },
    magasin: { findFirst: mockMagasinFindFirst },
    $transaction: vi.fn((cb: any) => cb({
      produit: { create: mockProduitCreate },
      stock: { create: mockStockCreate },
      mouvement: { create: mockMouvementCreate },
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

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserMouvementStock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { GET, POST } = await import('../produits/route')

function mockReq(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/produits')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function makeProduit(overrides = {}) {
  return {
    id: 1, code: 'PROD-001', designation: 'Produit Test', categorie: 'GENERAL',
    prixVente: 5000, prixAchat: 3000, pamp: 3000, actif: true, entiteId: 1,
    stocks: [{ id: 1, magasinId: 1, quantite: 100 }],
    ...overrides,
  }
}

describe('GET /api/produits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée', async () => {
    mockProduitCount.mockResolvedValue(1)
    mockProduitFindMany.mockResolvedValue([makeProduit()])

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].stockConsolide).toBe(100)
    expect(body.pagination.total).toBe(1)
  })

  it('filtre par recherche q', async () => {
    mockProduitCount.mockResolvedValue(1)
    mockProduitFindMany.mockResolvedValue([makeProduit()])

    await GET(mockReq({ q: 'Test' }))

    const [{ where }] = mockProduitFindMany.mock.calls[0]
    expect(where.OR[0].code.contains).toBe('test')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })

  it('mode complet retourne tous les produits', async () => {
    mockProduitFindMany.mockResolvedValue([makeProduit(), makeProduit({ id: 2, code: 'PROD-002' })])

    const res = await GET(mockReq({ complet: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(mockProduitCount).not.toHaveBeenCalled()
  })
})

describe('POST /api/produits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée un produit avec stock initial', async () => {
    mockProduitFindFirst.mockResolvedValue(null)
    mockMagasinFindFirst.mockResolvedValue({ id: 1, entiteId: 1 })
    mockProduitCreate.mockResolvedValue(makeProduit())
    mockStockCreate.mockResolvedValue({ id: 1, produitId: 1, magasinId: 1, quantite: 50 })
    mockMouvementCreate.mockResolvedValue({ id: 1, type: 'ENTREE', produitId: 1, quantite: 50 })

    const res = await POST(mockJson({
      designation: 'Nouveau Produit',
      categorie: 'GENERAL',
      prixVente: 5000,
      prixAchat: 3000,
      magasinId: 1,
      quantiteInitiale: 50,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.designation).toBe('Produit Test')
    expect(mockProduitCreate).toHaveBeenCalled()
  })

  it('génère un code automatique', async () => {
    mockProduitFindFirst.mockResolvedValue(null)
    mockMagasinFindFirst.mockResolvedValue({ id: 1, entiteId: 1 })
    mockProduitCreate.mockResolvedValue(makeProduit())
    mockStockCreate.mockResolvedValue({ id: 1, produitId: 1, magasinId: 1, quantite: 0 })
    mockMouvementCreate.mockResolvedValue({ id: 1, type: 'ENTREE', produitId: 1, quantite: 0 })

    await POST(mockJson({
      designation: 'Article A',
      categorie: 'ALIMENTAIRE',
      prixVente: 2000,
      prixAchat: 1000,
      magasinId: 1,
    }))

    expect(mockProduitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designation: 'Article A',
          categorie: 'ALIMENTAIRE',
        }),
      })
    )
  })

  it('rejette un produit sans désignation', async () => {
    const res = await POST(mockJson({
      prixVente: 5000,
      magasinId: 1,
    }))
    expect(res.status).toBe(400)
  })
})
