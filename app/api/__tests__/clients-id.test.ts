// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())
const mockVenteCount = vi.hoisted(() => vi.fn())
const mockReglementVenteCount = vi.hoisted(() => vi.fn())
const mockLogModification = vi.hoisted(() => vi.fn())
const mockLogSuppression = vi.hoisted(() => vi.fn())
const mockGetIpAddress = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'))
const mockValidateApiRequest = vi.hoisted(() => vi.fn())
const mockVerifierCloture = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    client: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      delete: mockDelete,
    },
    vente: { count: mockVenteCount, findFirst: vi.fn() },
    reglementVente: { count: mockReglementVenteCount },
    compteCourant: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
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

vi.mock('@/lib/audit', () => ({
  logModification: mockLogModification,
  logSuppression: mockLogSuppression,
  getIpAddress: mockGetIpAddress,
}))

vi.mock('@/lib/cloture', () => ({
  verifierCloture: mockVerifierCloture,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: mockValidateApiRequest,
}))

vi.mock('@/lib/validations', () => {
  const { z } = require('zod')
  return {
    clientSchema: z.object({ nom: z.string().optional(), telephone: z.string().optional(), soldeInitial: z.number().optional(), avoirInitial: z.number().optional(), email: z.string().optional(), type: z.string().optional(), plafondCredit: z.number().optional(), ncc: z.string().optional(), localisation: z.string().optional(), code: z.string().optional() }),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { PATCH, DELETE } = await import('../clients/[id]/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function mockReq(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function makeClient(overrides = {}) {
  return {
    id: 1, code: '000001A', nom: 'Client Test', telephone: '612345678',
    type: 'CASH', plafondCredit: null, ncc: null, localisation: null,
    soldeInitial: 0, avoirInitial: 0, pointsFidelite: 0, actif: true, entiteId: 1,
    ...overrides,
  }
}

describe('PATCH /api/clients/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si non authentifié', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    )
    const res = await PATCH(mockJson({ nom: 'Modifié' }), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 404 si client introuvable', async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await PATCH(mockJson({ nom: 'Modifié' }), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 400 si validation échoue', async () => {
    mockFindFirst.mockResolvedValue(makeClient())
    mockValidateApiRequest.mockReturnValue({
      success: false,
      response: NextResponse.json({ error: 'Validation échouée' }, { status: 400 }),
    })
    const res = await PATCH(mockJson({ nom: '' }), mockReq('1'))
    expect(res.status).toBe(400)
  })

  it('modifie un client avec succès', async () => {
    mockFindFirst.mockResolvedValue(makeClient())
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { nom: 'Client Modifié', telephone: '700000000' },
    })
    mockUpdate.mockResolvedValue(makeClient({ nom: 'Client Modifié', telephone: '700000000' }))

    const res = await PATCH(mockJson({ nom: 'Client Modifié', telephone: '700000000' }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nom).toBe('Client Modifié')
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockLogModification).toHaveBeenCalled()
  })

  it('modifie le soldeInitial avec vérification clôture', async () => {
    mockFindFirst.mockResolvedValue(makeClient({ soldeInitial: 0 }))
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { soldeInitial: 50000 },
    })
    mockUpdate.mockResolvedValue(makeClient({ soldeInitial: 50000 }))

    const res = await PATCH(mockJson({ soldeInitial: 50000 }), mockReq('1'))
    expect(res.status).toBe(200)
    expect(mockVerifierCloture).toHaveBeenCalled()
  })
})

describe('DELETE /api/clients/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await DELETE(mockJson({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    const res = await DELETE(mockJson({}), mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('retourne 404 si client introuvable', async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await DELETE(mockJson({}), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 409 si le client a des ventes ou règlements', async () => {
    mockFindFirst.mockResolvedValue(makeClient())
    mockVenteCount.mockResolvedValue(3)
    mockReglementVenteCount.mockResolvedValue(1)

    const res = await DELETE(mockJson({}), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('vente')
  })

  it('supprime un client sans ventes ni règlements', async () => {
    mockFindFirst.mockResolvedValue(makeClient())
    mockVenteCount.mockResolvedValue(0)
    mockReglementVenteCount.mockResolvedValue(0)
    mockDelete.mockResolvedValue(makeClient())

    const res = await DELETE(mockJson({}), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockLogSuppression).toHaveBeenCalled()
  })
})
