import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockVenteFindUnique = vi.hoisted(() => vi.fn())
const mockVenteDelete = vi.hoisted(() => vi.fn())
const mockCaisseFindMany = vi.hoisted(() => vi.fn())
const mockCaisseDeleteMany = vi.hoisted(() => vi.fn())
const mockRetourFindMany = vi.hoisted(() => vi.fn())
const mockRetourDeleteMany = vi.hoisted(() => vi.fn())
const mockOperationBancaireFindMany = vi.hoisted(() => vi.fn())
const mockOperationBancaireDeleteMany = vi.hoisted(() => vi.fn())
const mockBanqueUpdate = vi.hoisted(() => vi.fn())
const mockTxVenteUpdate = vi.hoisted(() => vi.fn())

function createMockTx() {
  return {
    vente: {
      findUnique: mockVenteFindUnique,
      findFirst: vi.fn(),
      delete: mockVenteDelete,
      update: mockTxVenteUpdate,
    },
    caisse: {
      findMany: mockCaisseFindMany,
      deleteMany: mockCaisseDeleteMany,
    },
    retour: {
      findMany: mockRetourFindMany,
      deleteMany: mockRetourDeleteMany,
    },
    operationBancaire: {
      findMany: mockOperationBancaireFindMany,
      deleteMany: mockOperationBancaireDeleteMany,
    },
    banque: { update: mockBanqueUpdate },
    stock: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    mouvement: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    ecritureComptable: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    reglementVenteLigne: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    reglementVente: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
    venteLigne: { update: vi.fn().mockResolvedValue({ id: 1 }) },
    retraitPartiel: { findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ id: 1 }) },
    client: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    produit: { findUnique: vi.fn() },
  }
}

const mockTx = vi.hoisted(() => createMockTx())
const mockTransaction = vi.hoisted(() => vi.fn((cb: (tx: any) => any) => cb(mockTx)))

vi.mock('@/lib/db', () => ({
  prisma: {
    vente: {
      findUnique: mockVenteFindUnique,
      findFirst: vi.fn(),
    },
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
  comptabiliserVente: vi.fn().mockResolvedValue(undefined),
  comptabiliserReglementVente: vi.fn().mockResolvedValue(undefined),
  comptabiliserLivraisonCommande: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: vi.fn().mockReturnValue({ success: true, data: {} }),
}))

vi.mock('@/lib/validations', () => ({
  venteSchema: { partial: vi.fn().mockReturnValue({}) },
}))

const { DELETE, PATCH } = await import('../ventes/[id]/route')

function mockReq(body?: any, params?: Record<string, string>): any {
  const url = new URL('http://localhost/api/ventes/1')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return {
    nextUrl: url,
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest
}

function makeVente(overrides = {}) {
  return {
    id: 1, numero: 'V20250001', date: new Date('2026-06-01'),
    montantTotal: 15000, montantPaye: 15000, statutPaiement: 'PAYE',
    modePaiement: 'ESPECES', statut: 'VALIDEE',
    magasinId: 1, entiteId: 1, clientId: 1,
    client: { id: 1, code: 'CL001', nom: 'Client', type: 'CASH' },
    clientLibre: null,
    lignes: [
      { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 0, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
    ],
    reglements: [{ id: 1, modePaiement: 'ESPECES', montant: 15000 }],
    ReglementVenteLigne: [{ reglementId: 1, montant: 15000 }],
    magasin: { id: 1, code: 'MAG01', nom: 'Magasin' },
    typeVente: 'VENTE',
    retraitDiffere: false,
    dateLivraison: null,
    numeroBon: null,
    fraisApproche: 0,
    remiseGlobale: 0,
    ...overrides,
  }
}

describe('DELETE /api/ventes/[id]', () => {
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

  it('retourne 500 si vente introuvable dans la transaction', async () => {
    mockVenteFindUnique.mockResolvedValue(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Vente introuvable')
  })

  it('retourne 500 si $transaction rejette', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('DB error'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })

  it('supprime une vente avec succès', async () => {
    mockVenteFindUnique.mockResolvedValue(makeVente())
    mockRetourFindMany.mockResolvedValue([])
    mockCaisseFindMany.mockResolvedValue([])
    mockOperationBancaireFindMany.mockResolvedValue([])

    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

describe('PATCH /api/ventes/[id]', () => {
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

  it('retourne 400 pour action non reconnue', async () => {
    const res = await PATCH(mockReq({ action: 'INVALID' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Action non reconnue')
  })

  it('retourne 404 si vente introuvable pour PAIEMENT', async () => {
    mockVenteFindUnique.mockResolvedValue(null)
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 5000 }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si montant zéro pour PAIEMENT', async () => {
    mockVenteFindUnique.mockResolvedValue(makeVente())
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 0 }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('traite un paiement avec succès (ESPECES)', async () => {
    mockTxVenteUpdate.mockResolvedValue(makeVente())
    mockVenteFindUnique.mockResolvedValue(makeVente({
      montantPaye: 5000,
      statutPaiement: 'PARTIEL',
      reglements: [{ id: 1, modePaiement: 'CREDIT', montant: 10000 }],
      ReglementVenteLigne: [],
    }))

    const res = await PATCH(mockReq({
      action: 'PAIEMENT',
      montant: 5000,
      modePaiement: 'ESPECES',
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })

  it('retourne 500 en cas d\'erreur', async () => {
    mockTxVenteUpdate.mockResolvedValue(makeVente())
    mockVenteFindUnique.mockResolvedValue(makeVente({
      montantPaye: 5000,
      statutPaiement: 'PARTIEL',
      ReglementVenteLigne: [],
    }))
    mockTransaction.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await PATCH(mockReq({ action: 'PAIEMENT', montant: 5000 }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

function makeFullUpdateVente(overrides = {}) {
  return makeVente({
    updatedAt: new Date(),
    date: new Date(Date.now() - 1000 * 3600),
    statut: 'VALIDEE',
    montantPaye: 5000,
    statutPaiement: 'PARTIEL',
    magasinId: 1,
    client: { id: 1, code: 'CL001', nom: 'Client Test', type: 'CASH' },
    lignes: [
      { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 0, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
    ],
    reglements: [{ id: 1, modePaiement: 'ESPECES', montant: 5000 }],
    ReglementVenteLigne: [{ reglementId: 1, montant: 5000 }],
    ...overrides,
  })
}

describe('PATCH /api/ventes/[id] — FULL_UPDATE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  it('retourne 404 si vente introuvable (preCheck)', async () => {
    mockVenteFindUnique.mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 2, prixUnitaire: 5000 }],
      modePaiement: 'ESPECES',
    }), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 500 si vente introuvable dans la transaction', async () => {
    mockVenteFindUnique
      .mockResolvedValueOnce({ updatedAt: new Date() })
      .mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 2, prixUnitaire: 5000 }],
      modePaiement: 'ESPECES',
      reglements: [{ mode: 'ESPECES', montant: 10000 }],
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Vente introuvable')
  })

  it('retourne 500 si vente ANNULEE', async () => {
    const ts = new Date()
    mockVenteFindUnique
      .mockResolvedValueOnce({ updatedAt: ts })
      .mockResolvedValueOnce(makeFullUpdateVente({ updatedAt: ts, statut: 'ANNULEE' }))
    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      lignes: [{ produitId: 1, quantite: 2, prixUnitaire: 5000 }],
      modePaiement: 'ESPECES',
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('annulée')
  })

  it('effectue une mise à jour complète avec succès', async () => {
    const ts = new Date()
    mockVenteFindUnique
      .mockResolvedValueOnce({ updatedAt: ts })
      .mockResolvedValueOnce(makeFullUpdateVente({ updatedAt: ts }))
    mockTxVenteUpdate.mockResolvedValue(makeFullUpdateVente())
    vi.mocked(mockTx.produit.findUnique).mockResolvedValue({ id: 1, designation: 'Article A', prixMinimum: 0, pamp: 3000, prixAchat: 3000 })
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    vi.mocked(mockTx.client.findUnique).mockResolvedValue({ id: 1, code: 'CL001' })

    const res = await PATCH(mockReq({
      action: 'FULL_UPDATE',
      clientId: 1,
      date: new Date().toISOString().split('T')[0],
      magasinId: 1,
      modePaiement: 'ESPECES',
      reglements: [{ mode: 'ESPECES', montant: 10000, banqueId: null }],
      lignes: [{ produitId: 1, quantite: 2, prixUnitaire: 5000, tva: 0, remise: 0 }],
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/ventes/[id] — LIVRER', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  function makeCommandeVente(overrides = {}) {
    return makeVente({
      typeVente: 'COMMANDE',
      retraitDiffere: false,
      dateLivraison: null,
      lignes: [
        { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 0, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
      ],
      ...overrides,
    })
  }

  it('retourne 404 si vente introuvable', async () => {
    mockVenteFindUnique.mockResolvedValue(null)
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si la vente n est pas une commande', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente({ typeVente: 'VENTE' }))
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('commande')
  })

  it('retourne 400 si la commande a déjà été livrée', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente({ dateLivraison: new Date() }))
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
  })

  it('retourne 500 si stock insuffisant', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 0 })
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Stock insuffisant')
  })

  it('retourne 500 si aucune ligne à livrer', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente({
      lignes: [
        { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 2, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
      ],
    }))
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Aucune ligne à livrer')
  })

  it('livre une commande complète avec succès', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    const res = await PATCH(mockReq({ action: 'LIVRER' }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toBe('Commande livrée avec succès.')
    expect(mockTxVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ dateLivraison: expect.any(Date) }) })
    )
  })

  it('livre partiellement avec lignes payload', async () => {
    mockVenteFindUnique.mockResolvedValue(makeCommandeVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    const res = await PATCH(mockReq({ action: 'LIVRER', lignes: [{ produitId: 1, quantite: 1 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toBe('Livraison partielle effectuée avec succès.')
    expect(mockTxVenteUpdate).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/ventes/[id] — RETRAIT_PARTIEL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx))
  })

  function makeRetraitDiffereVente(overrides = {}) {
    return makeVente({
      typeVente: 'VENTE',
      retraitDiffere: true,
      dateLivraison: null,
      lignes: [
        { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 0, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
      ],
      ...overrides,
    })
  }

  it('retourne 404 si vente introuvable', async () => {
    mockVenteFindUnique.mockResolvedValue(null)
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 1, quantite: 1 }] }), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
  })

  it('retourne 400 si la vente n est pas à retrait différé', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente({ retraitDiffere: false }))
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 1, quantite: 1 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('retrait différé')
  })

  it('retourne 400 si aucune ligne à retirer', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente())
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Aucune ligne')
  })

  it('retourne 500 si produitId introuvable dans la vente', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente())
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 999, quantite: 1 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Produit ID 999 introuvable')
  })

  it('retourne 500 si quantité dépasse le restant à retirer', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente({
      lignes: [
        { id: 1, produitId: 1, designation: 'Article A', quantite: 2, quantiteLivree: 1, prixUnitaire: 5000, montant: 10000, tva: 0, remise: 0, coutUnitaire: 3000 },
      ],
    }))
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 1, quantite: 5 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('restant à retirer')
  })

  it('retourne 500 si stock insuffisant', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 0 })
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 1, quantite: 1 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Stock insuffisant')
  })

  it('effectue un retrait partiel avec succès', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    vi.mocked(mockTx.retraitPartiel.findFirst).mockResolvedValue(null)
    const res = await PATCH(mockReq({ action: 'RETRAIT_PARTIEL', lignes: [{ produitId: 1, quantite: 1 }] }), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toContain('Retrait partiel effectué')
  })

  it('effectue un retrait partiel avec une date spécifique', async () => {
    mockVenteFindUnique.mockResolvedValue(makeRetraitDiffereVente())
    vi.mocked(mockTx.stock.findUnique).mockResolvedValue({ quantite: 100 })
    vi.mocked(mockTx.retraitPartiel.findFirst).mockResolvedValue(null)
    const res = await PATCH(mockReq({
      action: 'RETRAIT_PARTIEL',
      lignes: [{ produitId: 1, quantite: 1 }],
      date: '2026-06-15',
    }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
