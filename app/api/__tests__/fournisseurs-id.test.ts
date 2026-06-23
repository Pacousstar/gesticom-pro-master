// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())
const mockAchatCount = vi.hoisted(() => vi.fn())
const mockReglementAchatCount = vi.hoisted(() => vi.fn())
const mockLogSuppression = vi.hoisted(() => vi.fn())
const mockGetIpAddress = vi.hoisted(() => vi.fn().mockReturnValue('127.0.0.1'))
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    fournisseur: {
      findFirst: mockFindFirst,
      delete: mockDelete,
    },
    achat: { count: mockAchatCount },
    reglementAchat: { count: mockReglementAchatCount },
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
  logSuppression: mockLogSuppression,
  getIpAddress: mockGetIpAddress,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { DELETE } = await import('../fournisseurs/[id]/route')

function mockReq(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

function makeFournisseur(overrides = {}) {
  return {
    id: 1, code: 'F-001', nom: 'Fournisseur Test', telephone: '0102030405',
    email: 'test@fournisseur.com', ncc: 'NCC001', localisation: 'Localisation',
    numeroCamion: 'CAM-001', soldeInitial: 0, avoirInitial: 0, actif: true, entiteId: 1,
    ...overrides,
  }
}

describe('DELETE /api/fournisseurs/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await DELETE({} as NextRequest, mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    const res = await DELETE({} as NextRequest, mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('retourne 409 si le fournisseur a des achats ou règlements', async () => {
    mockAchatCount.mockResolvedValue(2)
    mockReglementAchatCount.mockResolvedValue(0)

    const res = await DELETE({} as NextRequest, mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('achat')
  })

  it('supprime un fournisseur sans achats ni règlements', async () => {
    mockAchatCount.mockResolvedValue(0)
    mockReglementAchatCount.mockResolvedValue(0)
    mockDelete.mockResolvedValue(makeFournisseur())

    const res = await DELETE({} as NextRequest, mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
