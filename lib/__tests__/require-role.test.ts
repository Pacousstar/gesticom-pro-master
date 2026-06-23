import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJson = vi.fn()

vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => mockJson(...args),
  },
}))

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('retourne 401 si session null', async () => {
    mockJson.mockReturnValue({ status: 401 })
    const { requireRole } = await import('@/lib/require-role')
    const result = requireRole(null, ['ADMIN'])
    expect(result).toBeDefined()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Non autorisé.' }, { status: 401 })
  })

  it('retourne 403 si rôle non autorisé', async () => {
    mockJson.mockReturnValue({ status: 403 })
    const { requireRole } = await import('@/lib/require-role')
    const result = requireRole({ userId: 1, role: 'MAGASINIER' } as any, ['ADMIN', 'SUPER_ADMIN'])
    expect(result).toBeDefined()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })
  })

  it('retourne null si rôle autorisé', async () => {
    const { requireRole } = await import('@/lib/require-role')
    const result = requireRole({ userId: 1, role: 'ADMIN' } as any, ['ADMIN', 'SUPER_ADMIN'])
    expect(result).toBeNull()
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('retourne 401 si session null', async () => {
    mockJson.mockReturnValue({ status: 401 })
    const { requirePermission } = await import('@/lib/require-role')
    const result = requirePermission(null, 'produits:view')
    expect(result).toBeDefined()
  })

  it('retourne null si permission accordée', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    const result = requirePermission({ userId: 1, role: 'ADMIN' } as any, 'produits:create')
    expect(result).toBeNull()
  })
})
