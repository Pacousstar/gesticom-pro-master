// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUnique2: vi.fn().mockResolvedValue({ id: 1 }),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  aggregate: vi.fn(),
  $transaction: vi.fn((fn: any) => fn({
    achat: { create: vi.fn().mockResolvedValue({ id: 1, numero: 'A-2024-0001' }), update: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    mouvement: { create: vi.fn() },
    stock: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: 1, quantite: 10, entiteId: 1 }) },
    produit: { findUnique: vi.fn() },
  })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    magasin: { findUnique: mocks.findUnique },
    fournisseur: { findUnique: mocks.findUnique },
    utilisateur: { findUnique: mocks.findUnique2 },
    produit: { findMany: mocks.findMany, findUnique: mocks.findUnique },
    achat: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    stock: { upsert: vi.fn(), findUnique: mocks.findUnique },
    mouvement: { create: mocks.create },
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
  comptabiliserAchat: vi.fn(),
}))

// Évite les erreurs d'import des enums
vi.mock('@prisma/client', () => ({
  ModeReglement: { ESPECES: 'ESPECES', CHEQUE: 'CHEQUE', VIREMENT: 'VIREMENT' },
  StatutAchat: { BROUILLON: 'BROUILLON', VALIDE: 'VALIDE' },
  TypeMouvement: { ENTREE: 'ENTREE', SORTIE: 'SORTIE' },
}))

vi.mock('next/server', () => ({
  NextResponse: { json: (body: any, init?: any) => ({ status: init?.status || 200, json: async () => body }) },
  NextRequest: class { },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { POST } = await import('../achats/route')

function mockJson(body: any): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest
}

describe('POST /api/achats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejette un achat sans lignes', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })
    mocks.findMany.mockResolvedValue([])

    const res = await POST(mockJson({ magasinId: 1, fournisseurId: 1, lignes: [] }))
    expect(res.status).toBe(400)
  })

  it('rejette un achat sans fournisseur', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })

    const res = await POST(mockJson({
      magasinId: 1,
      lignes: [{ produitId: 1, quantite: 1, prixUnitaire: 1000 }],
    }))
    expect(res.status).toBe(400)
  })

  it('rejette un achat avec produit inexistant', async () => {
    mocks.findUnique
      .mockResolvedValueOnce({ id: 1, entiteId: 1, code: 'MAG01', nom: 'Magasin' })
      .mockResolvedValueOnce({ id: 1, entiteId: 1, code: 'F001', raisonSociale: 'Fournisseur Test' })
    mocks.findMany.mockResolvedValue([])

    const res = await POST(mockJson({
      magasinId: 1,
      fournisseurId: 1,
      modeReglement: 'ESPECES',
      lignes: [{ produitId: 999, quantite: 1, prixUnitaire: 1000 }],
    }))
    expect(res.status).toBe(400)
  })
})
