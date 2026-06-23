import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockAggregate = vi.fn()
const mockCreate = vi.fn()
const mockFindFirst = vi.fn()
const mockUtilisateurFindUnique = vi.fn()
const mockMagasinFindUnique = vi.fn()
const mockMagasinFindFirst = vi.fn()
const mockValidate = vi.fn()
const mockComptabiliserDepense = vi.fn()
const mockEnregistrerMouvement = vi.fn()
const mockRecalculerSolde = vi.fn()

vi.mock('@/lib/db', () => {
  const p = {
    depense: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    utilisateur: {
      findUnique: (...args: unknown[]) => mockUtilisateurFindUnique(...args),
    },
    magasin: {
      findUnique: (...args: unknown[]) => mockMagasinFindUnique(...args),
      findFirst: (...args: unknown[]) => mockMagasinFindFirst(...args),
    },
    $transaction: vi.fn((cb: Function) => {
      const result = cb(p)
      if (result instanceof Promise) return result
      return Promise.resolve(result)
    }),
  }
  return { prisma: p }
})

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteIdOrAll: vi.fn(() => 1),
  getEntiteId: vi.fn(() => 1),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserDepense: (...args: unknown[]) => mockComptabiliserDepense(...args),
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: (...args: unknown[]) => mockEnregistrerMouvement(...args),
  recalculerSoldeCaisse: (...args: unknown[]) => mockRecalculerSolde(...args),
}))

vi.mock('@/lib/enums-commerce', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    estModeEspeces: vi.fn((m: string) => m === 'ESPECES'),
    estModeBanque: vi.fn((m: string) => ['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(m)),
  }
})

vi.mock('@/lib/banque', () => ({
  estModeBanque: vi.fn((m: string) => ['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(m)),
  enregistrerOperationBancaire: vi.fn(),
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

describe('GET /api/depenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/depenses/route')
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('retourne la liste paginée des dépenses', async () => {
    const fakeDepenses = [
      { id: 1, libelle: 'Achat fournitures', montant: 50000, montantPaye: 50000, statutPaiement: 'PAYE', date: new Date('2026-06-01'), modePaiement: 'ESPECES', categorie: 'FOURNITURES', beneficiaire: 'Fournisseur', createdAt: new Date(), magasin: { id: 1, code: 'M01', nom: 'Magasin 1' }, entite: { code: 'E01', nom: 'Entité 1' }, utilisateur: { nom: 'Admin', login: 'admin' } },
    ]

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue(fakeDepenses)
    mockCount.mockResolvedValue(1)
    mockAggregate.mockResolvedValue({ _sum: { montant: 50000 } })

    const { GET } = await import('@/app/api/depenses/route')
    const res = await GET(createRequest({ page: '1', limit: '100' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.totalAmount).toBe(50000)
    expect(body.pagination.total).toBe(1)
  })

  it('filtre par categorie', async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockAggregate.mockResolvedValue({ _sum: { montant: 0 } })

    const { GET } = await import('@/app/api/depenses/route')
    await GET(createRequest({ categorie: 'FOURNITURES' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categorie: 'FOURNITURES' }),
      })
    )
  })
})

describe('POST /api/depenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { POST } = await import('@/app/api/depenses/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé.')
  })

  it('crée une dépense espèces avec comptabilisation et caisse', async () => {
    const fakeDepense = {
      id: 1, libelle: 'Fournitures bureau', montant: 75000, montantPaye: 75000,
      statutPaiement: 'PAYE', date: new Date('2026-06-21'), modePaiement: 'ESPECES',
      categorie: 'FOURNITURES', beneficiaire: 'Papeterie X',
      magasin: { code: 'M01', nom: 'Principal' },
      entite: { code: 'E01', nom: 'Entité 1' },
      utilisateur: { nom: 'Admin', login: 'admin' },
    }

    mockValidate.mockReturnValue({
      success: true,
      data: { libelle: 'Fournitures bureau', montant: 75000, categorie: 'FOURNITURES', modePaiement: 'ESPECES', beneficiaire: 'Papeterie X' },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockFindFirst.mockResolvedValue(null) // pas de doublon
    mockCreate.mockResolvedValue(fakeDepense)
    mockMagasinFindFirst.mockResolvedValue({ id: 1 })

    const { POST } = await import('@/app/api/depenses/route')
    const res = await POST(createPostRequest({
      libelle: 'Fournitures bureau', montant: 75000, categorie: 'FOURNITURES', modePaiement: 'ESPECES',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.libelle).toBe('Fournitures bureau')
    expect(mockComptabiliserDepense).toHaveBeenCalled()
    expect(mockEnregistrerMouvement).toHaveBeenCalled()
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    const { POST } = await import('@/app/api/depenses/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation échouée')
  })
})
