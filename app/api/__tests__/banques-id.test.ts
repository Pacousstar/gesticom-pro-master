// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockOperationsCount = vi.fn()
const mockLogAction = vi.fn()
const mockValidate = vi.fn()
const mockApiCatch = vi.fn()
const mockEstTypeOperationBanqueEntree = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    banque: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    operationBancaire: {
      count: (...args: unknown[]) => mockOperationsCount(...args),
      findMany: vi.fn().mockResolvedValue([]),
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
  estTypeOperationBanqueEntree: (...args: unknown[]) => mockEstTypeOperationBanqueEntree(...args),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('@/lib/audit', () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

import { getSession } from '@/lib/auth'

function mockReq(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeBanque(overrides = {}) {
  return {
    id: 1, numero: 'SN001', nomBanque: 'BOA', libelle: 'Compte courant',
    soldeInitial: 500000, soldeActuel: 500000, entiteId: 1, actif: true,
    compte: { id: 1, numero: '512', libelle: 'Banque' },
    ...overrides,
  }
}

describe('PATCH /api/banques/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const { PATCH } = await import('../banques/[id]/route')
    const req = { json: () => Promise.resolve({}) } as any
    const res = await PATCH(req, mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    const { PATCH } = await import('../banques/[id]/route')
    const req = { json: () => Promise.resolve({}) } as any
    const res = await PATCH(req, mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('retourne 404 si banque introuvable', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockValidate.mockReturnValue({
      success: true,
      data: { nomBanque: 'Nouveau' },
    })
    mockFindUnique.mockResolvedValue(null)

    const { PATCH } = await import('../banques/[id]/route')
    const req = { json: () => Promise.resolve({ nomBanque: 'Nouveau' }) } as any
    const res = await PATCH(req, mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 400 si numéro dupliqué', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValueOnce(makeBanque())
    mockFindUnique.mockResolvedValueOnce({ id: 99 })
    mockValidate.mockReturnValue({
      success: true,
      data: { numero: 'SN002', nomBanque: 'BOA' },
    })

    const { PATCH } = await import('../banques/[id]/route')
    const req = { json: () => Promise.resolve({ numero: 'SN002', nomBanque: 'BOA' }) } as any
    const res = await PATCH(req, mockReq('1'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('existe déjà')
  })

  it('modifie une banque avec succès', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(makeBanque())
    mockValidate.mockReturnValue({
      success: true,
      data: { nomBanque: 'BOA Sénégal', libelle: 'Compte courant modifié' },
    })
    mockUpdate.mockResolvedValue(makeBanque({ nomBanque: 'BOA Sénégal', libelle: 'Compte courant modifié' }))

    const { PATCH } = await import('../banques/[id]/route')
    const req = { json: () => Promise.resolve({ nomBanque: 'BOA Sénégal' }) } as any
    const res = await PATCH(req, mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nomBanque).toBe('BOA Sénégal')
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('DELETE /api/banques/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const { DELETE } = await import('../banques/[id]/route')
    const res = await DELETE({} as any, mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 400 si ID invalide', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    const { DELETE } = await import('../banques/[id]/route')
    const res = await DELETE({} as any, mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('retourne 404 si banque introuvable', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(null)

    const { DELETE } = await import('../banques/[id]/route')
    const res = await DELETE({} as any, mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('désactive la banque si elle a des opérations', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(makeBanque())
    mockOperationsCount.mockResolvedValue(3)

    const { DELETE } = await import('../banques/[id]/route')
    const res = await DELETE({} as any, mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { actif: false } })
    )
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('supprime la banque si elle na pas dopérations', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(makeBanque())
    mockOperationsCount.mockResolvedValue(0)

    const { DELETE } = await import('../banques/[id]/route')
    const res = await DELETE({} as any, mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
