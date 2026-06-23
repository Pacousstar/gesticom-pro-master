import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockCreate = vi.fn()
const mockValidate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    commandeFournisseur: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
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

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

import { getSession } from '@/lib/auth'

function createRequest(searchParams?: Record<string, string>) {
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams ?? {}),
    },
  } as any
}

function createPostRequest(body: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: () => Promise.resolve(body),
  } as any
}

describe('GET /api/commandes-fournisseurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('retourne la liste paginée des commandes', async () => {
    const fakeCommandes = [
      {
        id: 1, numero: 'BC-2026-001', date: new Date('2026-06-01'), montantTotal: 150000, statut: 'BROUILLON',
        fournisseur: { nom: 'Fournisseur A', code: 'F001', telephone: '0102030405' },
        magasin: { nom: 'Magasin 1', code: 'M01' },
        lignes: [],
      },
      {
        id: 2, numero: 'BC-2026-002', date: new Date('2026-06-15'), montantTotal: 250000, statut: 'VALIDE',
        fournisseur: { nom: 'Fournisseur B', code: 'F002', telephone: '0504030201' },
        magasin: { nom: 'Magasin 2', code: 'M02' },
        lignes: [],
      },
    ]

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue(fakeCommandes)
    mockCount.mockResolvedValue(2)

    const { GET } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await GET(createRequest({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.page).toBe(1)
    expect(body.data[0].numero).toBe('BC-2026-001')
  })

  it('filtre par statut', async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const { GET } = await import('@/app/api/commandes-fournisseurs/route')
    await GET(createRequest({ statut: 'VALIDE' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: 'VALIDE' }),
      })
    )
  })

  it('export all ne retourne pas de pagination', async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await GET(createRequest({ export: 'all' }))
    const body = await res.json()

    expect(body.pagination).toBeUndefined()
    expect(body.totals).toBeDefined()
  })
})

describe('POST /api/commandes-fournisseurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { POST } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('crée une commande avec succès', async () => {
    const fakeCommande = {
      id: 1, numero: 'BC-2026-001', date: new Date('2026-06-21'),
      fournisseurId: 5, magasinId: 1, montantTotal: 150000, statut: 'BROUILLON',
      lignes: [
        { id: 1, produitId: 10, designation: 'Produit A', quantite: 5, prixUnitaire: 30000, montant: 150000 },
      ],
    }

    mockValidate.mockReturnValue({
      success: true,
      data: {
        fournisseurId: 5, magasinId: 1, montantTotal: 150000,
        lignes: [
          { produitId: 10, designation: 'Produit A', quantite: 5, prixUnitaire: 30000, montant: 150000 },
        ],
      },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValue(fakeCommande)

    const { POST } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await POST(createPostRequest({
      fournisseurId: 5, magasinId: 1, montantTotal: 150000,
      lignes: [{ produitId: 10, designation: 'Produit A', quantite: 5, prixUnitaire: 30000, montant: 150000 }],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.numero).toMatch(/^BC-2026/)
    expect(body.lignes).toHaveLength(1)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    const { POST } = await import('@/app/api/commandes-fournisseurs/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation échouée')
  })
})
