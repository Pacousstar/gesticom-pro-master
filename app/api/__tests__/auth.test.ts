import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockFindUniqueUtilisateur = vi.fn()
const mockFindUniqueEntite = vi.fn()
const mockCreateUtilisateur = vi.fn()
const mockCompare = vi.fn()
const mockHash = vi.fn()
const mockCreateToken = vi.fn()
const mockGetCookieName = vi.fn()
const mockGetSession = vi.fn()
const mockLogConnexion = vi.fn()
const mockLogDeconnexion = vi.fn()
const mockLogCreation = vi.fn()
const mockGetIpAddress = vi.fn()
const mockGetUserAgent = vi.fn()
const mockRequirePermission = vi.fn()
const mockApiCatch = vi.fn()
const mockCookiesSet = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    utilisateur: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueUtilisateur(...args),
      create: (...args: unknown[]) => mockCreateUtilisateur(...args),
    },
    entite: {
      findUnique: (...args: unknown[]) => mockFindUniqueEntite(...args),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  getCookieName: (...args: unknown[]) => mockGetCookieName(...args),
}))

vi.mock('@/lib/audit', () => ({
  logConnexion: (...args: unknown[]) => mockLogConnexion(...args),
  logDeconnexion: (...args: unknown[]) => mockLogDeconnexion(...args),
  logCreation: (...args: unknown[]) => mockLogCreation(...args),
  getIpAddress: (...args: unknown[]) => mockGetIpAddress(...args),
  getUserAgent: (...args: unknown[]) => mockGetUserAgent(...args),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: (...args: unknown[]) => mockApiCatch(...args),
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: (...args: unknown[]) => mockHash(...args),
  },
  compare: (...args: unknown[]) => mockCompare(...args),
  hash: (...args: unknown[]) => mockHash(...args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ set: (...args: unknown[]) => mockCookiesSet(...args) })),
}))

vi.mock('@/lib/validations', () => {
  const { z } = require('zod')
  return {
    loginSchema: z.object({
      login: z.string().min(1, 'Identifiants requis.'),
      motDePasse: z.string().min(1, 'Identifiants requis.'),
      redirect: z.string().optional(),
    }),
    strictPasswordSchema: z.string().min(8),
  }
})

const fakeUser = {
  id: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN',
  motDePasse: '$2a$10$hashed', entiteId: 1,
  permissionsPersonnalisees: null,
}

const fakeSession = { userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1 }

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/auth/login'),
    json: vi.fn().mockResolvedValue(body || {}),
  }
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompare.mockResolvedValue(true)
    mockCreateToken.mockResolvedValue('fake-token')
    mockGetCookieName.mockReturnValue('token')
    mockGetIpAddress.mockReturnValue('127.0.0.1')
    mockGetUserAgent.mockReturnValue('vitest')
  })

  it('retourne 400 si body invalide', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const req = { ...mockReq({ login: 123, motDePasse: 456 }) }
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retourne 400 si login manquant', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ motDePasse: 'pass' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si motDePasse manquant', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ login: 'admin' }))
    expect(res.status).toBe(400)
  })

  it('retourne 401 si utilisateur introuvable', async () => {
    mockFindFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ login: 'inconnu', motDePasse: 'pass' }))
    expect(res.status).toBe(401)
  })

  it('retourne 401 si mot de passe incorrect', async () => {
    mockFindFirst.mockResolvedValue(fakeUser)
    mockCompare.mockResolvedValue(false)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ login: 'admin', motDePasse: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('connecte un utilisateur avec succès et retourne redirect', async () => {
    mockFindFirst.mockResolvedValue(fakeUser)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ login: 'admin', motDePasse: 'password' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.redirect).toBe('/dashboard')
    expect(mockCreateToken).toHaveBeenCalled()
    expect(mockCookiesSet).toHaveBeenCalled()
    expect(mockLogConnexion).toHaveBeenCalled()
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockFindFirst.mockRejectedValue(new Error('Erreur DB'))
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(mockReq({ login: 'admin', motDePasse: 'password' }))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(fakeSession as any)
    mockGetIpAddress.mockReturnValue('127.0.0.1')
    mockGetCookieName.mockReturnValue('token')
  })

  it('déconnecte et redirige vers /login', async () => {
    const { POST } = await import('@/app/api/auth/logout/route')
    const req = { nextUrl: new URL('http://localhost/api/auth/logout'), url: 'http://localhost' } as any
    const res = await POST(req)
    expect(res.status).toBe(307)
    expect(mockLogDeconnexion).toHaveBeenCalled()
    expect(mockCookiesSet).toHaveBeenCalled()
  })

  it('redirige même sans session active', async () => {
    mockGetSession.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/logout/route')
    const req = { nextUrl: new URL('http://localhost/api/auth/logout'), url: 'http://localhost' } as any
    const res = await POST(req)
    expect(res.status).toBe(307)
    expect(mockLogDeconnexion).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/register', () => {
  const registerData = {
    login: 'newuser', nom: 'Nouvel Utilisateur',
    motDePasse: 'StrongPass1', role: 'GESTIONNAIRE', entiteId: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(fakeSession as any)
    mockRequirePermission.mockReturnValue(undefined)
    mockHash.mockResolvedValue('$2a$10$hashed')
    mockCreateUtilisateur.mockResolvedValue({ id: 2, login: 'newuser', nom: 'Nouvel Utilisateur', role: 'GESTIONNAIRE', actif: true, email: null, createdAt: new Date() })
    mockGetIpAddress.mockReturnValue('127.0.0.1')
  })

  it('retourne 401 sans session', async () => {
    mockGetSession.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    mockRequirePermission.mockReturnValue(new Response(null, { status: 403 }))
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(403)
  })

  it('retourne 400 si validation échoue', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq({ login: 'ab' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si entité introuvable', async () => {
    mockFindUniqueEntite.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si login déjà utilisé', async () => {
    mockFindUniqueEntite.mockResolvedValue({ id: 1 })
    mockFindUniqueUtilisateur.mockResolvedValue({ id: 99 })
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(400)
  })

  it('crée un utilisateur avec succès', async () => {
    mockFindUniqueEntite.mockResolvedValue({ id: 1 })
    mockFindUniqueUtilisateur.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.message).toBe('Utilisateur créé avec succès.')
    expect(body.user).toBeDefined()
    expect(mockLogCreation).toHaveBeenCalled()
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockFindUniqueEntite.mockRejectedValue(new Error('Erreur DB'))
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(mockReq(registerData))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/auth/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 sans session', async () => {
    mockGetSession.mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/check/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("retourne les infos de l'utilisateur connecté", async () => {
    mockGetSession.mockResolvedValue(fakeSession as any)
    const { GET } = await import('@/app/api/auth/check/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.login).toBe('admin')
    expect(body.role).toBe('SUPER_ADMIN')
  })
})
