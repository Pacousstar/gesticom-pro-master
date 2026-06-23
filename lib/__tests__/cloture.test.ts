import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    parametre: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

describe('verifierCloture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passe si SUPER_ADMIN', async () => {
    const { verifierCloture } = await import('@/lib/cloture')
    await expect(verifierCloture(new Date('2026-01-01'), { role: 'SUPER_ADMIN' })).resolves.toBeUndefined()
  })

  it('passe si aucune clôture définie', async () => {
    mockFindFirst.mockResolvedValue(null)
    const { verifierCloture } = await import('@/lib/cloture')
    await expect(verifierCloture(new Date('2026-06-21'), { role: 'ADMIN' })).resolves.toBeUndefined()
  })

  it('passe si la date est après la clôture', async () => {
    mockFindFirst.mockResolvedValue({ dateCloture: new Date('2026-01-01') })
    const { verifierCloture } = await import('@/lib/cloture')
    await expect(verifierCloture(new Date('2026-06-21'), { role: 'ADMIN' })).resolves.toBeUndefined()
  })

  it('rejette si la date est avant la clôture', async () => {
    mockFindFirst.mockResolvedValue({ dateCloture: new Date('2026-06-30') })
    const { verifierCloture } = await import('@/lib/cloture')
    await expect(verifierCloture(new Date('2026-01-15'), { role: 'ADMIN' })).rejects.toThrow('VERROU DE CLÔTURE')
  })
})
