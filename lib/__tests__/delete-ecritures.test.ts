import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDeleteMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    ecritureComptable: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}))

describe('deleteEcrituresByReference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supprime les écritures et retourne le nombre', async () => {
    mockDeleteMany.mockResolvedValue({ count: 3 })
    const { deleteEcrituresByReference } = await import('@/lib/delete-ecritures')
    const result = await deleteEcrituresByReference('VENTE', 42)
    expect(result).toBe(3)
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { referenceId: 42, referenceType: 'VENTE' },
    })
  })
})

describe('deleteEcrituresByReferenceForIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supprime les écritures pour plusieurs IDs', async () => {
    mockDeleteMany.mockResolvedValue({ count: 5 })
    const { deleteEcrituresByReferenceForIds } = await import('@/lib/delete-ecritures')
    const result = await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', [1, 2, 3])
    expect(result).toBe(5)
  })

  it('retourne 0 si tableau vide', async () => {
    const { deleteEcrituresByReferenceForIds } = await import('@/lib/delete-ecritures')
    const result = await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', [])
    expect(result).toBe(0)
    expect(mockDeleteMany).not.toHaveBeenCalled()
  })
})
