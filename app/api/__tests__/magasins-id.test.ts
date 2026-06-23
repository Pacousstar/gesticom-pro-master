// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const mockMagasinFindFirst = vi.hoisted(() => vi.fn())
const mockMagasinUpdate = vi.hoisted(() => vi.fn())
const mockLogModification = vi.hoisted(() => vi.fn())
const mockLogSuppression = vi.hoisted(() => vi.fn())
const mockGetIpAddress = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'))
const mockValidateApiRequest = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    magasin: {
      findFirst: mockMagasinFindFirst,
      update: mockMagasinUpdate,
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
  logSuppression: mockLogSuppression,
  getIpAddress: mockGetIpAddress,
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: mockValidateApiRequest,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('@/lib/validations', () => {
  const { z } = require('zod')
  return {
    magasinSchema: z.object({ code: z.string().optional(), nom: z.string().optional(), localisation: z.string().optional() }),
  }
})

const { PATCH, DELETE } = await import('../magasins/[id]/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

function mockReq(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function makeMagasin(overrides = {}) {
  return {
    id: 1, code: 'MAG-001', nom: 'Magasin Principal', localisation: 'Dakar',
    actif: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('PATCH /api/magasins/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si non authentifié', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    )
    const res = await PATCH(mockJson({ nom: 'Modifié' }), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 404 si magasin introuvable', async () => {
    mockMagasinFindFirst.mockResolvedValue(null)
    const res = await PATCH(mockJson({ nom: 'Modifié' }), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 400 si body vide', async () => {
    mockMagasinFindFirst.mockResolvedValue(makeMagasin())
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: {},
    })
    const res = await PATCH(mockJson({}), mockReq('1'))
    expect(res.status).toBe(400)
  })

  it('modifie un magasin avec succès', async () => {
    mockMagasinFindFirst.mockResolvedValue(makeMagasin())
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { nom: 'Magasin Modifié', localisation: 'Thiès' },
    })
    mockMagasinUpdate.mockResolvedValue(makeMagasin({ nom: 'Magasin Modifié', localisation: 'Thiès' }))

    const res = await PATCH(mockJson({ nom: 'Magasin Modifié', localisation: 'Thiès' }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nom).toBe('Magasin Modifié')
    expect(mockLogModification).toHaveBeenCalled()
  })

  it('retourne 400 si code déjà utilisé', async () => {
    mockMagasinFindFirst
      .mockResolvedValueOnce(makeMagasin())
      .mockResolvedValueOnce({ id: 2, code: 'MAG-002' })
    mockValidateApiRequest.mockReturnValue({
      success: true,
      data: { code: 'MAG-002' },
    })

    const res = await PATCH(mockJson({ code: 'MAG-002' }), mockReq('1'))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/magasins/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si non authentifié', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    )
    const res = await DELETE(mockJson({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 404 si magasin introuvable', async () => {
    mockMagasinFindFirst.mockResolvedValue(null)
    const res = await DELETE(mockJson({}), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('désactive un magasin avec succès', async () => {
    mockMagasinFindFirst.mockResolvedValue(makeMagasin())
    mockMagasinUpdate.mockResolvedValue(makeMagasin({ actif: false }))

    const res = await DELETE(mockJson({}), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockMagasinUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { actif: false } })
    )
    expect(mockLogSuppression).toHaveBeenCalled()
  })
})
