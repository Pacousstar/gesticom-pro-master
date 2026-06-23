import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockEcritureFindUnique = vi.fn()
const mockJournalFindUnique = vi.fn()
const mockPlanFindUnique = vi.fn()
const mockValidate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    ecritureComptable: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockEcritureFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    journal: {
      findUnique: (...args: unknown[]) => mockJournalFindUnique(...args),
    },
    planCompte: {
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
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
    json: () => Promise.resolve({}),
  } as any
}

function createPostRequest(body: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: () => Promise.resolve(body),
  } as any
}

describe('GET /api/ecritures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { GET } = await import('@/app/api/ecritures/route')
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('retourne la liste des écritures', async () => {
    const fakeEcritures = [
      { id: 1, numero: 'ECR-001', date: new Date('2026-06-01'), libelle: 'Vente', debit: 100000, credit: 0, journal: { code: 'VTE', libelle: 'Ventes' }, compte: { numero: '701', libelle: 'Ventes' }, utilisateur: { nom: 'Admin', login: 'admin' } },
      { id: 2, numero: 'ECR-002', date: new Date('2026-06-02'), libelle: 'Achat', debit: 0, credit: 50000, journal: { code: 'ACH', libelle: 'Achats' }, compte: { numero: '601', libelle: 'Achats' }, utilisateur: { nom: 'Admin', login: 'admin' } },
    ]

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue(fakeEcritures)

    const { GET } = await import('@/app/api/ecritures/route')
    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].libelle).toBe('Vente')
    expect(body[1].libelle).toBe('Achat')
  })

  it('filtre par journalId', async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/ecritures/route')
    await GET(createRequest({ journalId: '1' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ journalId: 1 }),
      })
    )
  })
})

describe('POST /api/ecritures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const { POST } = await import('@/app/api/ecritures/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Non autorisé')
  })

  it('crée une écriture avec succès', async () => {
    const fakeEcriture = {
      id: 1, numero: 'ECR-1740500000-ABC123', date: new Date('2026-06-21'),
      journalId: 1, libelle: 'Vente journalière', compteId: 5, debit: 100000, credit: 0,
      journal: { code: 'VTE', libelle: 'Ventes' },
      compte: { numero: '701', libelle: 'Ventes de marchandises' },
      utilisateur: { nom: 'Admin', login: 'admin' },
    }

    mockValidate.mockReturnValue({
      success: true,
      data: { journalId: 1, libelle: 'Vente journalière', compteId: 5, debit: 100000, credit: 0 },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockJournalFindUnique.mockResolvedValue({ id: 1, code: 'VTE', libelle: 'Ventes' })
    mockPlanFindUnique.mockResolvedValue({ id: 5, numero: '701', libelle: 'Ventes de marchandises' })
    mockCreate.mockResolvedValue(fakeEcriture)

    const { POST } = await import('@/app/api/ecritures/route')
    const res = await POST(createPostRequest({
      journalId: 1, libelle: 'Vente journalière', compteId: 5, debit: 100000, credit: 0,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.libelle).toBe('Vente journalière')
    expect(body.numero).toMatch(/^ECR-/)
  })

  it('refuse si validation échoue', async () => {
    mockValidate.mockReturnValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    const { POST } = await import('@/app/api/ecritures/route')
    const res = await POST(createPostRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation échouée')
  })

  it('refuse si journal introuvable', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { journalId: 999, libelle: 'Test', compteId: 5, debit: 100, credit: 0 },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockJournalFindUnique.mockResolvedValue(null)

    const { POST } = await import('@/app/api/ecritures/route')
    const res = await POST(createPostRequest({
      journalId: 999, libelle: 'Test', compteId: 5, debit: 100, credit: 0,
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Journal introuvable.')
  })

  it('refuse si compte introuvable', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { journalId: 1, libelle: 'Test', compteId: 999, debit: 100, credit: 0 },
    })

    vi.mocked(getSession).mockResolvedValue({
      userId: 1, role: 'ADMIN', entiteId: 1,
    } as any)

    mockJournalFindUnique.mockResolvedValue({ id: 1 })
    mockPlanFindUnique.mockResolvedValue(null)

    const { POST } = await import('@/app/api/ecritures/route')
    const res = await POST(createPostRequest({
      journalId: 1, libelle: 'Test', compteId: 999, debit: 100, credit: 0,
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Compte introuvable.')
  })
})
