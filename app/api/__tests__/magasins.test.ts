// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

const mockMagasinFindMany = vi.hoisted(() => vi.fn())
const mockMagasinFindFirst = vi.hoisted(() => vi.fn())
const mockMagasinCreate = vi.hoisted(() => vi.fn())
const mockLogModification = vi.hoisted(() => vi.fn())
const mockGetIpAddress = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'))
const mockValidateApiRequest = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    magasin: {
      findMany: mockMagasinFindMany,
      findFirst: mockMagasinFindFirst,
      create: mockMagasinCreate,
    },
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
  logModification: mockLogModification,
  getIpAddress: mockGetIpAddress,
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: mockValidateApiRequest,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

const { GET, POST } = await import('../magasins/route')

function mockReq(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/magasins')
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  return { nextUrl: url, json: vi.fn() } as unknown as NextRequest
}

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function makeMagasin(overrides = {}) {
  return {
    id: 1, code: 'MAG-001', nom: 'Magasin Principal', localisation: 'Dakar',
    actif: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('GET /api/magasins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne la liste des magasins actifs', async () => {
    mockMagasinFindMany.mockResolvedValue([makeMagasin()])

    const res = await GET(mockReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].code).toBe('MAG-001')
    expect(mockMagasinFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actif: true } })
    )
  })

  it('retourne tous les magasins avec ?tous=1', async () => {
    mockMagasinFindMany.mockResolvedValue([
      makeMagasin(),
      makeMagasin({ id: 2, code: 'MAG-002', actif: false }),
    ])

    const res = await GET(mockReq({ tous: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(mockMagasinFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })
})

describe('POST /api/magasins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crée un magasin', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { code: 'MAG-001', nom: 'Magasin Test', localisation: 'Dakar' },
    })
    mockMagasinFindFirst.mockResolvedValue(null)
    mockMagasinCreate.mockResolvedValue(makeMagasin())

    const res = await POST(mockJson({ code: 'MAG-001', nom: 'Magasin Test', localisation: 'Dakar' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.code).toBe('MAG-001')
    expect(mockMagasinCreate).toHaveBeenCalled()
    expect(mockLogModification).toHaveBeenCalled()
  })

  it('rejette les données invalides', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: false,
      response: NextResponse.json({ error: 'Validation échouée' }, { status: 400 }),
    })

    const res = await POST(mockJson({}))
    expect(res.status).toBe(400)
  })

  it('rejette un code en double', async () => {
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { code: 'MAG-001', nom: 'Magasin Test', localisation: 'Dakar' },
    })
    mockMagasinFindFirst.mockResolvedValue(makeMagasin())

    const res = await POST(mockJson({ code: 'MAG-001', nom: 'Magasin Test', localisation: 'Dakar' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('existe déjà')
  })
})
