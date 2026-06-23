import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDeleteMany = vi.fn()
const mockDelete = vi.fn()
const mockTransaction = vi.fn()
const mockValidate = vi.fn()

const mockUnauthorized = vi.fn(() => new Response(null, { status: 401 }))
const mockNotFound = vi.fn(() => new Response(null, { status: 404 }))
const mockBadRequest = vi.fn(() => new Response(null, { status: 400 }))
const mockHandleApiError = vi.fn(() => new Response(null, { status: 500 }))

vi.mock('@/lib/db', () => ({
  prisma: {
    commandeFournisseur: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    commandeFournisseurLigne: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: vi.fn(() => 1),
}))

vi.mock('@/lib/api-error', () => ({
  unauthorized: () => mockUnauthorized(),
  notFound: () => mockNotFound(),
  badRequest: () => mockBadRequest(),
  handleApiError: () => mockHandleApiError(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/validations', () => ({
  commandeFournisseurSchema: { partial: vi.fn(() => ({})) },
}))

import { getSession } from '@/lib/auth'

const { PATCH, DELETE } = await import('@/app/api/commandes-fournisseurs/[id]/route')

const defaultSession = { userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1 }

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/commandes-fournisseurs/1'),
    json: vi.fn().mockResolvedValue(body || {}),
  }
}

describe('PATCH /api/commandes-fournisseurs/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockFindUnique.mockResolvedValue({ id: 1, statut: 'BROUILLON' })
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValueOnce({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })
    const res = await PATCH(mockReq({ statut: 'INVALID' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('effectue une mise à jour simple (statut) avec succès', async () => {
    mockUpdate.mockResolvedValue({ id: 1, statut: 'VALIDE' })
    const res = await PATCH(mockReq({ statut: 'VALIDE' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ statut: 'VALIDE' }) })
    )
  })

  it('effectue une mise à jour complète (avec lignes) via transaction', async () => {
    mockTransaction.mockResolvedValue([{ count: 0 }, { id: 1 }])
    const res = await PATCH(mockReq({
      lignes: [{ produitId: 1, designation: 'Article A', quantite: 10, prixUnitaire: 5000, montant: 50000 }],
      fournisseurId: 1,
      magasinId: 1,
      montantTotal: 50000,
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockUpdate.mockRejectedValue(new Error('Erreur serveur'))
    const res = await PATCH(mockReq({ statut: 'VALIDE' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/commandes-fournisseurs/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si commande introuvable', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si commande pas en brouillon', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, statut: 'VALIDE' })
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, statut: 'BROUILLON' })
    mockDeleteMany.mockRejectedValue(new Error('Erreur serveur'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })

  it('supprime une commande en brouillon avec succès', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, statut: 'BROUILLON' })
    mockDeleteMany.mockResolvedValue({ count: 2 })
    mockDelete.mockResolvedValue({ id: 1 })
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { commandeId: 1 } })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
