// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockPlanFindFirst = vi.hoisted(() => vi.fn())
const mockEcritureAggregate = vi.hoisted(() => vi.fn())
const mockEcritureFindMany = vi.hoisted(() => vi.fn())
const mockEcritureDeleteMany = vi.hoisted(() => vi.fn())
const mockEcritureFindFirst = vi.hoisted(() => vi.fn())
const mockEcritureCreate = vi.hoisted(() => vi.fn())
const mockJournalUpsert = vi.hoisted(() => vi.fn())
const mockPlanUpsert = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const mockVerifierCloture = vi.hoisted(() => vi.fn())
const mockGetEntiteId = vi.hoisted(() => vi.fn())
const mockMouvementCaisse = vi.hoisted(() => vi.fn())
const mockRecalculerSolde = vi.hoisted(() => vi.fn())
const mockApiCatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    planCompte: {
      findFirst: mockPlanFindFirst,
      upsert: mockPlanUpsert,
    },
    ecritureComptable: {
      aggregate: mockEcritureAggregate,
      findMany: mockEcritureFindMany,
      deleteMany: mockEcritureDeleteMany,
      findFirst: mockEcritureFindFirst,
      create: mockEcritureCreate,
    },
    journal: {
      upsert: mockJournalUpsert,
    },
    $transaction: mockTransaction,
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

vi.mock('@/lib/cloture', () => ({
  verifierCloture: mockVerifierCloture,
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: mockGetEntiteId,
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: mockMouvementCaisse,
  recalculerSoldeCaisse: mockRecalculerSolde,
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: mockApiCatch,
}))

vi.mock('@/lib/banque', () => ({
  enregistrerOperationBancaire: vi.fn(),
}))

const { GET, POST } = await import('../associes/remboursement/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetEntiteId.mockResolvedValue(1)
  mockVerifierCloture.mockResolvedValue(undefined)
})

describe('GET /api/associes/remboursement', () => {
  it('retourne 401 si non authentifié', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET({} as NextRequest)
    expect(res.status).toBe(401)
  })

  it('retourne le solde du 455 et l\'historique', async () => {
    mockPlanFindFirst.mockResolvedValue({ id: 15, numero: '455' })
    mockEcritureAggregate
      .mockResolvedValueOnce({ _sum: { debit: 0 } })
      .mockResolvedValueOnce({ _sum: { credit: 118600 } })
    mockEcritureFindMany.mockResolvedValue([
      { id: 1, date: new Date('2026-07-01'), libelle: 'Remboursement compte courant associé RA1', debit: 10000, credit: 0, piece: 'RA1' },
    ])

    const res = await GET({} as NextRequest)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.solde).toBe(118600)
    expect(body.historique).toHaveLength(1)
    expect(body.historique[0].debit).toBe(10000)
  })
})

describe('POST /api/associes/remboursement', () => {
  it('retourne 400 si montant invalide', async () => {
    const res = await POST(mockJson({ montant: 0, modePaiement: 'ESPECES' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si caisse manquante pour espèces', async () => {
    const res = await POST(mockJson({ montant: 5000, modePaiement: 'ESPECES' }))
    expect(res.status).toBe(400)
  })

  it('retourne 400 si solde du 455 insuffisant', async () => {
    mockPlanFindFirst.mockResolvedValue({ id: 15, numero: '455' })
    mockEcritureAggregate
      .mockResolvedValueOnce({ _sum: { debit: 0 } })
      .mockResolvedValueOnce({ _sum: { credit: 3000 } })

    const res = await POST(mockJson({ montant: 10000, modePaiement: 'ESPECES', magasinId: 1 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('insuffisant')
  })

  it('rembourse avec succès depuis la caisse', async () => {
    mockPlanFindFirst.mockResolvedValue({ id: 15, numero: '455' })
    mockEcritureAggregate
      .mockResolvedValueOnce({ _sum: { debit: 0 } })
      .mockResolvedValueOnce({ _sum: { credit: 118600 } })
    mockTransaction.mockImplementation(async (cb: any) => cb({
      ecritureComptable: {
        deleteMany: mockEcritureDeleteMany,
        findFirst: mockEcritureFindFirst,
        create: mockEcritureCreate,
      },
      journal: { upsert: mockJournalUpsert },
      planCompte: { upsert: mockPlanUpsert },
    }))
    mockMouvementCaisse.mockResolvedValue({ id: 42 })
    mockRecalculerSolde.mockResolvedValue(undefined)
    mockEcritureDeleteMany.mockResolvedValue({ count: 0 })
    mockEcritureFindFirst.mockResolvedValue(null)
    mockEcritureCreate.mockImplementation(({ data }: any) => ({ id: 99, ...data }))
    mockJournalUpsert.mockImplementation(({ create }: any) => ({ id: 2, ...create }))
    mockPlanUpsert.mockImplementation(({ create }: any) => ({ id: 100, ...create }))

    const res = await POST(mockJson({ montant: 10000, modePaiement: 'ESPECES', magasinId: 1, observation: 'Avance' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.solde).toBe(108600)
    expect(mockMouvementCaisse).toHaveBeenCalledWith(
      expect.objectContaining({ magasinId: 1, type: 'SORTIE', montant: 10000 }),
      expect.anything()
    )
    expect(mockVerifierCloture).toHaveBeenCalled()
  })
})
