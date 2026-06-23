// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockStockFindFirst = vi.hoisted(() => vi.fn())
const mockStockUpdate = vi.hoisted(() => vi.fn())
const mockMouvementCreate = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    stock: {
      findFirst: mockStockFindFirst,
      update: mockStockUpdate,
    },
    mouvement: {
      create: mockMouvementCreate,
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

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { PATCH } = await import('../stock/[id]/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function mockReq(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function makeStock(overrides = {}) {
  return {
    id: 1, produitId: 1, magasinId: 1, entiteId: 1,
    quantite: 100, quantiteInitiale: 100,
    ...overrides,
  }
}

describe('PATCH /api/stock/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await PATCH(mockJson({ quantite: 50 }), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    const res = await PATCH(mockJson({ quantite: 50 }), mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('retourne 404 si stock introuvable', async () => {
    mockStockFindFirst.mockResolvedValue(null)
    const res = await PATCH(mockJson({ quantite: 50 }), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 400 si aucun champ fourni', async () => {
    mockStockFindFirst.mockResolvedValue(makeStock())
    const res = await PATCH(mockJson({}), mockReq('1'))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si validation échoue (quantite négative)', async () => {
    mockStockFindFirst.mockResolvedValue(makeStock())
    const res = await PATCH(mockJson({ quantite: -5 }), mockReq('1'))
    expect(res.status).toBe(400)
  })

  it('modifie la quantité avec création de mouvement', async () => {
    mockStockFindFirst.mockResolvedValue(makeStock())
    mockStockUpdate.mockResolvedValue(makeStock({ quantite: 80 }))

    const res = await PATCH(mockJson({ quantite: 80 }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quantite).toBe(80)
    // Diff = -20 => SORTIE
    expect(mockMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SORTIE', quantite: 20 }),
      })
    )
  })

  it('modifie la quantitéInitiale sans mouvement', async () => {
    mockStockFindFirst.mockResolvedValue(makeStock())
    mockStockUpdate.mockResolvedValue(makeStock({ quantiteInitiale: 150 }))

    const res = await PATCH(mockJson({ quantiteInitiale: 150 }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quantiteInitiale).toBe(150)
    expect(mockMouvementCreate).not.toHaveBeenCalled()
  })

  it('crée un mouvement ENTREE si quantité augmente', async () => {
    mockStockFindFirst.mockResolvedValue(makeStock({ quantite: 100 }))
    mockStockUpdate.mockResolvedValue(makeStock({ quantite: 120 }))

    await PATCH(mockJson({ quantite: 120 }), mockReq('1'))

    expect(mockMouvementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ENTREE', quantite: 20 }),
      })
    )
  })
})
