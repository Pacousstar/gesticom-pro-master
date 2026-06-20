// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockFournisseurFindMany = vi.hoisted(() => vi.fn())
const mockFournisseurFindFirst = vi.hoisted(() => vi.fn())
const mockFournisseurCount = vi.hoisted(() => vi.fn())
const mockFournisseurCreate = vi.hoisted(() => vi.fn())
const mockFournisseurUpdate = vi.hoisted(() => vi.fn())
const mockAchatGroupBy = vi.hoisted(() => vi.fn())
const mockReglementAchatGroupBy = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    fournisseur: {
      findMany: mockFournisseurFindMany,
      findFirst: mockFournisseurFindFirst,
      count: mockFournisseurCount,
      create: mockFournisseurCreate,
      update: mockFournisseurUpdate,
    },
    achat: { groupBy: mockAchatGroupBy },
    reglementAchat: { groupBy: mockReglementAchatGroupBy },
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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { GET, POST } = await import('../fournisseurs/route')
const { PATCH } = await import('../fournisseurs/[id]/route')

function mockReq(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/fournisseurs')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function makeFournisseur(overrides = {}) {
  return {
    id: 1, code: 'F-001', nom: 'Fournisseur Test', telephone: '0102030405',
    email: 'test@fournisseur.com', ncc: 'NCC001', localisation: 'Localisation',
    numeroCamion: 'CAM-001', soldeInitial: 0, avoirInitial: 0, actif: true, entiteId: 1,
    ...overrides,
  }
}

describe('GET /api/fournisseurs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne une liste paginée avec dettes', async () => {
    mockFournisseurCount.mockResolvedValue(1)
    mockFournisseurFindMany.mockResolvedValue([makeFournisseur()])
    mockAchatGroupBy.mockResolvedValue([])
    mockReglementAchatGroupBy.mockResolvedValue([])

    const res = await GET(mockReq({ page: '1', limit: '20' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].dette).toBe(0)
    expect(body.pagination.total).toBe(1)
  })

  it('filtre par recherche q', async () => {
    mockFournisseurCount.mockResolvedValue(1)
    mockFournisseurFindMany.mockResolvedValue([makeFournisseur()])
    mockAchatGroupBy.mockResolvedValue([])
    mockReglementAchatGroupBy.mockResolvedValue([])

    await GET(mockReq({ q: 'Test' }))

    const [{ where }] = mockFournisseurFindMany.mock.calls[0]
    expect(where.OR[0].nom.contains).toBe('Test')
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })

  it('mode complet retourne tous les fournisseurs', async () => {
    mockFournisseurFindMany.mockResolvedValue([makeFournisseur(), makeFournisseur({ id: 2, code: 'F-002' })])

    const res = await GET(mockReq({ complet: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(mockFournisseurCount).not.toHaveBeenCalled()
  })
})

describe('POST /api/fournisseurs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée un fournisseur', async () => {
    mockFournisseurCreate.mockResolvedValue(makeFournisseur())

    const res = await POST(mockJson({
      nom: 'Nouveau Fournisseur',
      telephone: '0607080910',
      email: 'nouveau@fournisseur.com',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nom).toBe('Fournisseur Test')
    expect(mockFournisseurCreate).toHaveBeenCalled()
  })

  it('génère un code automatique', async () => {
    mockFournisseurCount.mockResolvedValue(5)
    mockFournisseurCreate.mockResolvedValue(makeFournisseur())

    await POST(mockJson({ nom: 'Alpha' }))

    expect(mockFournisseurCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nom: 'Alpha',
          code: '000006A',
        }),
      })
    )
  })

  it('rejette un fournisseur sans nom', async () => {
    const res = await POST(mockJson({}))
    expect(res.status).toBe(400)
  })

  it('retourne 409 pour code dupliqué', async () => {
    mockFournisseurCreate.mockRejectedValueOnce({ code: 'P2002' })

    const res = await POST(mockJson({ nom: 'Doublon' }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/fournisseurs/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('modifie un fournisseur', async () => {
    mockFournisseurFindFirst.mockResolvedValue(makeFournisseur())
    mockFournisseurUpdate.mockResolvedValue({ ...makeFournisseur(), nom: 'Modifié' })

    const req = mockJson({ nom: 'Modifié' })
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nom).toBe('Modifié')
    expect(mockFournisseurUpdate).toHaveBeenCalled()
  })

  it('retourne 404 pour fournisseur introuvable', async () => {
    mockFournisseurFindFirst.mockResolvedValue(null)

    const req = mockJson({ nom: 'Inconnu' })
    const res = await PATCH(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('rejette un body invalide (nom vide)', async () => {
    mockFournisseurFindFirst.mockResolvedValue(makeFournisseur())

    const req = mockJson({ nom: '' })
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })
})
