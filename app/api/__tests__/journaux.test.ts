import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockValidate = vi.fn()

const mockUnauthorized = vi.fn(() => new Response(null, { status: 401 }))
const mockNotFound = vi.fn(() => new Response(null, { status: 404 }))
const mockHandleApiError = vi.fn(() => new Response(null, { status: 500 }))

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
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

vi.mock('@/lib/api-error', () => ({
  unauthorized: () => mockUnauthorized(),
  notFound: () => mockNotFound(),
  handleApiError: () => mockHandleApiError(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/validations', () => ({
  journalSchema: { partial: vi.fn(() => ({})) },
}))

import { getSession } from '@/lib/auth'

const { POST } = await import('@/app/api/journaux/route')
const { PATCH, DELETE } = await import('@/app/api/journaux/[id]/route')

const defaultSession = { userId: 1, login: 'admin', role: 'SUPER_ADMIN', entiteId: 1 }
const fakeJournal = { id: 1, code: 'JRN', libelle: 'Journal Test', type: 'ACHAT', actif: true }

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/journaux'),
    json: vi.fn().mockResolvedValue(body || {}),
  }
}

function errorResponse400(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400 })
}

describe('POST /api/journaux', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockCreate.mockResolvedValue(fakeJournal)
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(mockReq({ code: 'JRN', libelle: 'Test', type: 'ACHAT' }))
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await POST(mockReq({ code: 'JRN', libelle: 'Test', type: 'ACHAT' }))
    expect(res.status).toBe(403)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValueOnce({ success: false, response: errorResponse400('Validation') })
    const res = await POST(mockReq({ code: '' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si code journal dupliqué (P2002)', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { code: 'JRN', libelle: 'Test', type: 'ACHAT' } })
    const err = new Error('Unique constraint')
    ;(err as any).code = 'P2002'
    mockCreate.mockRejectedValueOnce(err)
    const res = await POST(mockReq({ code: 'JRN', libelle: 'Test', type: 'ACHAT' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('existe déjà')
  })

  it('crée un journal avec succès', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { code: 'JRN', libelle: 'Mon Journal', type: 'VENTE' } })
    mockCreate.mockResolvedValueOnce(fakeJournal)
    const res = await POST(mockReq({ code: 'JRN', libelle: 'Mon Journal', type: 'VENTE' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe('JRN')
    expect(mockCreate).toHaveBeenCalledWith({
      data: { code: 'JRN', libelle: 'Mon Journal', type: 'VENTE', actif: true },
    })
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await POST(mockReq({ code: 'JRN', libelle: 'Test', type: 'ACHAT' }))
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/journaux/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockUpdate.mockResolvedValue(fakeJournal)
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

  it('retourne 400 si code dupliqué (P2002)', async () => {
    const err = new Error('Unique constraint')
    ;(err as any).code = 'P2002'
    mockUpdate.mockRejectedValueOnce(err)
    const res = await PATCH(mockReq({ code: 'JRN' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('existe déjà')
  })

  it('met à jour un journal avec succès', async () => {
    mockUpdate.mockResolvedValueOnce({ ...fakeJournal, libelle: 'Modifié' })
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

describe('DELETE /api/journaux/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockUpdate.mockResolvedValue(fakeJournal)
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

  it('désactive un journal avec succès (soft delete)', async () => {
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
