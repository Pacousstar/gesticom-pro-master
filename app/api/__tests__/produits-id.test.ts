import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockProduitFindFirst = vi.hoisted(() => vi.fn())
const mockProduitUpdate = vi.hoisted(() => vi.fn())
const mockProduitDelete = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    produit: {
      findFirst: mockProduitFindFirst,
      update: mockProduitUpdate,
      delete: mockProduitDelete,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1,
  }),
}))

const mockRequirePermission = vi.hoisted(() => vi.fn((session: any) => {
  if (!session) return new Response(null, { status: 401 }) as any
  return null
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/audit', () => ({
  logModification: vi.fn().mockResolvedValue(undefined),
  logSuppression: vi.fn().mockResolvedValue(undefined),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: vi.fn().mockReturnValue({ success: true, data: {} }),
}))

vi.mock('@/lib/validations', () => ({
  produitSchema: {},
}))

const { PATCH, DELETE, POST } = await import('../produits/[id]/route')

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/produits/1'),
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest
}

function makeProduit(overrides = {}) {
  return {
    id: 1, code: 'PROD-001', designation: 'Produit Test', categorie: 'GENERAL',
    prixVente: 5000, prixAchat: 3000, prixMinimum: 0, seuilMin: 5,
    fournisseurId: null, actif: true, pamp: 3000, entiteId: 1,
    createdAt: new Date('2026-01-01'),
    stocks: [{ id: 1, magasinId: 1, quantite: 0 }],
    ...overrides,
  }
}

describe('PATCH /api/produits/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('retourne 401 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      new Response(null, { status: 401 }) as any,
    )
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 400 pour ID négatif', async () => {
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si produit introuvable', async () => {
    mockProduitFindFirst.mockResolvedValue(null)
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si produit archivé', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit({ actif: false }))
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si aucune donnée à modifier', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    const res = await PATCH(mockReq({}), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('met à jour la désignation avec succès', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    mockProduitUpdate.mockResolvedValue(makeProduit({ designation: 'Nouveau nom' }))

    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.designation).toBe('Nouveau nom')
  })

  it('met à jour le prix de vente', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    mockProduitUpdate.mockResolvedValue(makeProduit({ prixVente: 6000 }))

    const res = await PATCH(mockReq({ prixVente: 6000 }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
  })

  it('gère l\'erreur P2025 (Prisma not found)', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    mockProduitUpdate.mockRejectedValueOnce({ code: 'P2025' })

    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(404)
  })

  it('retourne 500 en cas d\'erreur serveur', async () => {
    mockProduitFindFirst.mockRejectedValueOnce(new Error('DB error'))
    const res = await PATCH(mockReq({ designation: 'Nouveau nom' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/produits/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 401 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      new Response(null, { status: 401 }) as any,
    )
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si produit introuvable', async () => {
    mockProduitFindFirst.mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si stock > 0', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit({
      stocks: [{ id: 1, quantite: 10 }],
    }))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('stock')
  })

  it('supprime un produit avec succès (stock = 0)', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit({ stocks: [{ id: 1, quantite: 0 }] }))
    mockProduitDelete.mockResolvedValue(makeProduit())

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('gère l\'erreur P2025', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit({ stocks: [{ id: 1, quantite: 0 }] }))
    mockProduitDelete.mockRejectedValueOnce({ code: 'P2025' })

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 500 en cas d\'erreur serveur', async () => {
    mockProduitFindFirst.mockRejectedValueOnce(new Error('DB error'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/produits/[id] (archive/restore)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await POST(mockReq({ action: 'archive' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('retourne 404 si produit introuvable', async () => {
    mockProduitFindFirst.mockResolvedValue(null)
    const res = await POST(mockReq({ action: 'archive' }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('archive un produit avec succès', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    mockProduitUpdate.mockResolvedValue(makeProduit({ actif: false }))

    const res = await POST(mockReq({ action: 'archive' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.softDeleted).toBe(true)
  })

  it('restaure un produit avec succès', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit({ actif: false }))
    mockProduitUpdate.mockResolvedValue(makeProduit({ actif: true }))

    const res = await POST(mockReq({ action: 'restore' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.restored).toBe(true)
  })

  it('retourne 400 pour action inconnue', async () => {
    const res = await POST(mockReq({ action: 'invalid' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('gère l\'erreur P2025', async () => {
    mockProduitFindFirst.mockResolvedValue(makeProduit())
    mockProduitUpdate.mockRejectedValueOnce({ code: 'P2025' })

    const res = await POST(mockReq({ action: 'archive' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(404)
  })
})
