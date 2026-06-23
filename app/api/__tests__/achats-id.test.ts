import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockAchatFindUnique = vi.hoisted(() => vi.fn())
const mockAchatDelete = vi.hoisted(() => vi.fn())
const mockCaisseFindMany = vi.hoisted(() => vi.fn())
const mockCaisseDeleteMany = vi.hoisted(() => vi.fn())
const mockOperationBancaireFindMany = vi.hoisted(() => vi.fn())
const mockOperationBancaireDelete = vi.hoisted(() => vi.fn())
const mockBanqueUpdate = vi.hoisted(() => vi.fn())
const mockTxAchatUpdate = vi.hoisted(() => vi.fn())

function createMockTx() {
  return {
    achat: {
      findUnique: mockAchatFindUnique,
      delete: mockAchatDelete,
      update: mockTxAchatUpdate,
    },
    caisse: {
      findMany: mockCaisseFindMany,
      deleteMany: mockCaisseDeleteMany,
    },
    operationBancaire: {
      findMany: mockOperationBancaireFindMany,
      delete: mockOperationBancaireDelete,
    },
    banque: { update: mockBanqueUpdate },
    stock: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    mouvement: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    ecritureComptable: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    reglementAchatLigne: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    reglementAchat: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    produit: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    magasin: { findUnique: vi.fn() },
  }
}

const mockTx = vi.hoisted(() => createMockTx())
const mockTransaction = vi.hoisted(() => vi.fn((cb: (tx: any) => any) => cb(mockTx)))

vi.mock('@/lib/db', () => ({
  prisma: {
    achat: { findUnique: mockAchatFindUnique },
    $transaction: mockTransaction,
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1,
  }),
}))

const mockRequirePermission = vi.hoisted(() => vi.fn((session: any) => {
  if (!session) return new Response(null, { status: 401 }) as any
  return null
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/delete-ecritures', () => ({
  deleteEcrituresByReference: vi.fn().mockResolvedValue(1),
  deleteEcrituresByReferenceForIds: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/lib/audit', () => ({
  logSuppression: vi.fn().mockResolvedValue(undefined),
  logModification: vi.fn().mockResolvedValue(undefined),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/cloture', () => ({
  verifierCloture: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: vi.fn().mockResolvedValue(undefined),
  recalculerSoldeCaisse: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/enums-commerce', () => ({
  estModeEspeces: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/banque', () => ({
  estModeBanque: vi.fn().mockReturnValue(false),
  enregistrerOperationBancaire: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserAchat: vi.fn().mockResolvedValue(undefined),
  comptabiliserReglementAchat: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: vi.fn().mockReturnValue({ success: true, data: {} }),
}))

vi.mock('@/lib/validations', () => ({
  achatSchema: { partial: vi.fn().mockReturnValue({}) },
}))

const { DELETE, PATCH } = await import('../achats/[id]/route')

function mockReq(body?: any, params?: Record<string, string>): any {
  const url = new URL('http://localhost/api/achats/1')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return {
    nextUrl: url,
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest
}

function makeAchat(overrides = {}) {
  return {
    id: 1, numero: 'A20250001', date: new Date('2026-06-01'),
    montantTotal: 30000, montantPaye: 30000, statutPaiement: 'PAYE',
    modePaiement: 'ESPECES', statut: 'VALIDEE',
    magasinId: 1, entiteId: 1, fournisseurId: 1,
    fournisseur: { id: 1, nom: 'Fournisseur Test', code: 'F001' },
    fournisseurLibre: null,
    lignes: [
      { id: 1, produitId: 1, designation: 'Article A', quantite: 10, prixUnitaire: 3000, montant: 30000, tva: 0, remise: 0, htNet: 30000, coutUnitaire: 3000 },
    ],
    reglements: [{ id: 1, modePaiement: 'ESPECES', montant: 30000, banqueId: null }],
    ReglementAchatLigne: [{ reglementId: 1, montant: 30000 }],
    magasin: { id: 1, code: 'MAG01', nom: 'Magasin' },
    numeroCamion: null,
    fraisApproche: 0,
    ...overrides,
  }
}

describe('DELETE /api/achats/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 pour rôle non autorisé', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 1, role: 'ASSISTANTE', entiteId: 1,
    } as any)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 pour ID négatif', async () => {
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '-1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 500 si achat introuvable dans la transaction', async () => {
    mockAchatFindUnique.mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Erreur serveur')
  })

  it('retourne 500 si $transaction rejette', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('DB error'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })

  it('supprime un achat avec succès', async () => {
    mockAchatFindUnique.mockResolvedValue(makeAchat())
    mockCaisseFindMany.mockResolvedValue([])
    mockOperationBancaireFindMany.mockResolvedValue([])

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

describe('PATCH /api/achats/[id] — PAIEMENT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 401 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(
      new Response(null, { status: 401 }) as any,
    )
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 5000 }), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 400 pour mode CREDIT', async () => {
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 5000, modePaiement: 'CREDIT' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 400 pour montant zéro', async () => {
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 0 }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si achat introuvable', async () => {
    mockAchatFindUnique.mockResolvedValue(null)
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 5000 }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('traite un paiement avec succès', async () => {
    mockAchatFindUnique.mockResolvedValue(makeAchat({
      montantPaye: 10000,
      statutPaiement: 'PARTIEL',
      ReglementAchatLigne: [],
    }))

    const res = await PATCH(mockReq({
      action: 'PAIEMENT',
      montant: 5000,
      modePaiement: 'ESPECES',
      payeDepuisCaisse: true,
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/achats/[id] — FULL_UPDATE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  it('retourne 404 si achat introuvable (preCheck)', async () => {
    mockAchatFindUnique.mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 3000 }],
    }), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 500 si achat introuvable dans la transaction', async () => {
    const ts = new Date()
    mockAchatFindUnique
      .mockResolvedValueOnce({ updatedAt: ts })
      .mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 3000 }],
      modePaiement: 'ESPECES',
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Achat introuvable')
  })

  it('retourne 500 si achat ANNULEE', async () => {
    const ts = new Date()
    mockAchatFindUnique
      .mockResolvedValueOnce({ updatedAt: ts })
      .mockResolvedValueOnce(makeAchat({ updatedAt: ts, statut: 'ANNULEE' }))
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 3000 }],
      modePaiement: 'ESPECES',
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('annulé')
  })

  it('effectue une mise à jour complète avec succès', async () => {
    const ts = new Date()
    mockAchatFindUnique
      .mockResolvedValueOnce({ updatedAt: ts })
      .mockResolvedValueOnce(makeAchat({ updatedAt: ts }))
    mockTxAchatUpdate.mockResolvedValue(makeAchat())
    vi.mocked(mockTx.produit.findUnique)
      .mockResolvedValueOnce({ id: 1, designation: 'Article A', prixAchat: 3000, pamp: 3000 })
      .mockResolvedValueOnce({ id: 1, designation: 'Article A', prixAchat: 3000, pamp: 3000, stocks: [{ quantite: 50 }] })
    vi.mocked(mockTx.magasin.findUnique).mockResolvedValue({ id: 1, entiteId: 1 })

    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      fournisseurId: 1,
      date: new Date().toISOString().split('T')[0],
      magasinId: 1,
      modePaiement: 'ESPECES',
      reglements: [{ mode: 'ESPECES', montant: 30000, banqueId: null, payeDepuisCaisse: true, payeDepuisBanque: false }],
      lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 3000, tva: 0, remise: 0 }],
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })
})
