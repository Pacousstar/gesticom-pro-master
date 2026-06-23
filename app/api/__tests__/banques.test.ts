import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockGroupBy = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUtilisateurFindUnique = vi.fn()
const mockPlanFindUnique = vi.fn()
const mockPlanFindFirst = vi.fn()
const mockLogAction = vi.fn()
const mockValidate = vi.fn()
const mockJson = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    banque: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    operationBancaire: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    utilisateur: {
      findUnique: (...args: unknown[]) => mockUtilisateurFindUnique(...args),
    },
    planCompte: {
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPlanFindFirst(...args),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/banque', () => ({
  estTypeOperationBanqueEntree: vi.fn((type: string) => type === 'VERSEMENT'),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
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
    nextUrl: {
      searchParams: new URLSearchParams(),
    },
    json: () => Promise.resolve(body),
  } as any
}

describe('GET /api/banques', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/banques/route')
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé.')
  })

  it('retourne la liste des banques avec solde', async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: 1,
      role: 'ADMIN',
      entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue([
      { id: 1, nomBanque: 'BOA', libelle: 'Compte courant', soldeInitial: 1000, numero: '001', actif: true, createdAt: new Date(), compte: null, entiteId: 1 },
      { id: 2, nomBanque: 'Ecobank', libelle: 'Épargne', soldeInitial: 5000, numero: '002', actif: true, createdAt: new Date(), compte: null, entiteId: 1 },
    ])

    mockGroupBy
      .mockResolvedValueOnce([
        { banqueId: 1, _sum: { montant: 500 } },
        { banqueId: 2, _sum: { montant: 1000 } },
      ])
      .mockResolvedValueOnce([
        { banqueId: 1, type: 'VERSEMENT', _sum: { montant: 300 } },
        { banqueId: 1, type: 'RETRAIT', _sum: { montant: 100 } },
        { banqueId: 2, type: 'VERSEMENT', _sum: { montant: 500 } },
      ])

    const { GET } = await import('@/app/api/banques/route')
    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].soldeActuel).toBe(1200)
    expect(body.data[1].soldeActuel).toBe(5500)
  })
})

describe('POST /api/banques', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { POST } = await import('@/app/api/banques/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé.')
  })

  it('crée une banque avec validation réussie', async () => {
    const fakeBanque = {
      id: 1, numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant',
      soldeInitial: 500000, soldeActuel: 500000, entiteId: 1,
      compte: { id: 1, numero: '512', libelle: 'Banque' },
    }

    mockValidate.mockReturnValue({
      success: true,
      data: { numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant', soldeInitial: 500000 },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindUnique.mockResolvedValue(null)
    mockUtilisateurFindUnique.mockResolvedValue({ id: 1, entiteId: 1 })
    mockCreate.mockResolvedValue(fakeBanque)

    const { POST } = await import('@/app/api/banques/route')
    const res = await POST(createPostRequest({
      numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant', soldeInitial: 500000,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(1)
    expect(body.nomBanque).toBe('BOA')
  })

  it('refuse un numéro de compte dupliqué', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant', soldeInitial: 0 },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindUnique.mockResolvedValue({ id: 99 })

    const { POST } = await import('@/app/api/banques/route')
    const res = await POST(createPostRequest({
      numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Ce numéro de compte existe déjà.')
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    const { POST } = await import('@/app/api/banques/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation échouée')
  })
})
