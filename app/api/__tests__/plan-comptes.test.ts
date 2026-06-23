import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockValidate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    planCompte: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/validations', () => ({
  planCompteSchema: { partial: vi.fn(() => ({})) },
}))

import { getSession } from '@/lib/auth'

const { POST } = await import('@/app/api/plan-comptes/route')
const { PATCH, DELETE } = await import('@/app/api/plan-comptes/[id]/route')

const defaultSession = { userId: 1, login: 'admin', role: 'SUPER_ADMIN', entiteId: 1 }
const fakeCompte = { id: 1, numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'TIERS', actif: true }

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/plan-comptes'),
    json: vi.fn().mockResolvedValue(body || {}),
  }
}

function errorResponse400(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400 })
}

describe('POST /api/plan-comptes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockCreate.mockResolvedValue(fakeCompte)
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(mockReq({ numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'TIERS' }))
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await POST(mockReq({ numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'TIERS' }))
    expect(res.status).toBe(403)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValueOnce({ success: false, response: errorResponse400('Validation') })
    const res = await POST(mockReq({ numero: '' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si numéro dupliqué (P2002)', async () => {
    const err = new Error('Unique constraint')
    ;(err as any).code = 'P2002'
    mockCreate.mockRejectedValueOnce(err)
    const res = await POST(mockReq({ numero: '401', libelle: 'Test', classe: '4', type: 'TIERS' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('existe déjà')
  })

  it('crée un compte avec succès', async () => {
    mockCreate.mockResolvedValueOnce(fakeCompte)
    const res = await POST(mockReq({ numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'TIERS' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.numero).toBe('401')
    expect(mockCreate).toHaveBeenCalledWith({
      data: { numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'TIERS', actif: true },
    })
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await POST(mockReq({ numero: '401', libelle: 'Test', classe: '4', type: 'TIERS' }))
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/plan-comptes/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockUpdate.mockResolvedValue(fakeCompte)
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PATCH(mockReq({ libelle: 'Nouveau' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await PATCH(mockReq({ libelle: 'Nouveau' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await PATCH(mockReq({ libelle: 'Nouveau' }), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValueOnce({ success: false, response: errorResponse400('Validation') })
    const res = await PATCH(mockReq({ libelle: '' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si numéro dupliqué (P2002)', async () => {
    const err = new Error('Unique constraint')
    ;(err as any).code = 'P2002'
    mockUpdate.mockRejectedValueOnce(err)
    const res = await PATCH(mockReq({ numero: '401' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('existe déjà')
  })

  it('met à jour un compte avec succès', async () => {
    mockUpdate.mockResolvedValueOnce({ ...fakeCompte, libelle: 'Modifié' })
    const res = await PATCH(mockReq({ libelle: 'Modifié' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.libelle).toBe('Modifié')
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { libelle: 'Modifié' } })
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await PATCH(mockReq({ libelle: 'Test' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/plan-comptes/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockUpdate.mockResolvedValue(fakeCompte)
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('désactive un compte avec succès (soft delete)', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { actif: false } })
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})
