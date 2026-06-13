// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    magasin: { findUnique: mocks.findUnique },
    produit: { findMany: mocks.findMany },
    vente: { create: mocks.create, findUnique: vi.fn().mockResolvedValue(null) },
    stock: { findUnique: mocks.findUnique, update: mocks.update },
    mouvement: { create: mocks.create },
    reglementVente: { create: mocks.create },
    reglementVenteLigne: { create: mocks.create },
    caisse: { create: mocks.create },
    systemAlerte: { create: mocks.create },
    client: { findUnique: mocks.findUnique },
    $transaction: mocks.$transaction,
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
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn(),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserVente: vi.fn(),
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: vi.fn(),
  recalculerSoldeCaisse: vi.fn(),
}))

vi.mock('@/lib/banque', () => ({
  estModeBanque: vi.fn().mockReturnValue(false),
}))

vi.mock('next/server', () => ({
  NextResponse: { json: (body: any, init?: any) => ({ status: init?.status || 200, json: async () => body }) },
  NextRequest: class { },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { POST } = await import('../ventes/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

describe('POST /api/ventes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejette une vente sans lignes', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })

    const res = await POST(mockJson({ magasinId: 1, lignes: [] }))
    expect(res.status).toBe(400)
  })

  it('rejette une vente avec produit inexistant', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })
    mocks.findMany.mockResolvedValue([])

    const res = await POST(mockJson({
      magasinId: 1,
      lignes: [{ produitId: 999, quantite: 1, prixUnitaire: 1000 }],
    }))
    expect(res.status).toBe(400)
  })

  it('rejette une vente sans magasin', async () => {
    const res = await POST(mockJson({ lignes: [{ produitId: 1, quantite: 1, prixUnitaire: 1000 }] }))
    expect(res.status).toBe(400)
  })

  it('rejette paiement dépassant le total', async () => {
    vi.setConfig({ testTimeout: 15000 })
    mocks.findUnique.mockResolvedValue({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })
    mocks.findMany.mockResolvedValue([
      { id: 1, designation: 'Produit Test', prixMinimum: 0, pamp: 500, prixAchat: 500 }
    ])
    mocks.$transaction.mockRejectedValue(new Error('should not reach'))

    const res = await POST(mockJson({
      magasinId: 1,
      modePaiement: 'ESPECES',
      montantPaye: 999999,
      lignes: [{ produitId: 1, quantite: 1, prixUnitaire: 1000 }],
    }))
    expect(res.status).toBe(400)
  })
})
