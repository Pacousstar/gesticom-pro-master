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
const mockComptabiliserCharge = vi.fn()
const mockEnregistrerMouvement = vi.fn()
const mockRecalculerSolde = vi.fn()

vi.mock('@/lib/db', () => {
  const p = {
    charge: {
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

vi.mock('@/lib/api-response', () => ({
  successList: vi.fn((data, pagination, totals) =>
    new Response(JSON.stringify({ data, pagination, totalAmount: totals.totalAmount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserCharge: (...args: unknown[]) => mockComptabiliserCharge(...args),
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
    json: async () => ({}),
  } as any
}

function createPostRequest(body: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: () => Promise.resolve(body),
  } as any
}

describe('GET /api/charges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/charges/route')
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('retourne la liste paginée des charges', async () => {
    const fakeCharges = [
      {
        id: 1, rubrique: 'Loyer', montant: 500000, type: 'FIXE',
        date: new Date('2026-06-01'), modePaiement: 'ESPECES',
        beneficiaire: null, observation: null,
        magasin: { id: 1, code: 'M01', nom: 'Principal' },
        entite: { id: 1, code: 'E01', nom: 'Entité 1' },
        utilisateur: { nom: 'Admin', login: 'admin' },
      },
      {
        id: 2, rubrique: 'Électricité', montant: 25000, type: 'VARIABLE',
        date: new Date('2026-06-15'), modePaiement: 'CHEQUE',
        beneficiaire: 'SBEE', observation: 'Facture mai',
        magasin: null,
        entite: { id: 1, code: 'E01', nom: 'Entité 1' },
        utilisateur: { nom: 'Admin', login: 'admin' },
      },
    ]

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue(fakeCharges)
    mockCount.mockResolvedValue(2)
    mockAggregate.mockResolvedValue({ _sum: { montant: 525000 } })

    const { GET } = await import('@/app/api/charges/route')
    const res = await GET(createRequest({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.totalAmount).toBe(525000)
  })
})

describe('POST /api/charges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { POST } = await import('@/app/api/charges/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('crée une charge espèces avec comptabilisation et caisse', async () => {
    const fakeCharge = {
      id: 1, rubrique: 'Loyer', montant: 500000, type: 'FIXE',
      date: new Date('2026-06-01'), modePaiement: 'ESPECES',
      beneficiaire: null, observation: 'Local principal',
      magasin: { code: 'M01', nom: 'Principal' },
      entite: { code: 'E01', nom: 'Entité 1' },
      utilisateur: { nom: 'Admin', login: 'admin' },
    }

    mockValidate.mockReturnValue({
      success: true,
      data: { rubrique: 'Loyer', montant: 500000, type: 'FIXE', magasinId: 1, observation: 'Local principal' },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockUtilisateurFindUnique.mockResolvedValue({ id: 1 })
    mockFindFirst.mockResolvedValue(null) // pas de doublon
    mockMagasinFindUnique.mockResolvedValue({ id: 1, entiteId: 1 })
    mockCreate.mockResolvedValue(fakeCharge)
    mockMagasinFindFirst.mockResolvedValue({ id: 1 })

    const { POST } = await import('@/app/api/charges/route')
    const res = await POST(createPostRequest({
      rubrique: 'Loyer', montant: 500000, type: 'FIXE', magasinId: 1,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.rubrique).toBe('Loyer')
    expect(mockEnregistrerMouvement).toHaveBeenCalled()
    expect(mockRecalculerSolde).toHaveBeenCalled()
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    const { POST } = await import('@/app/api/charges/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation échouée')
  })
})
