import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockJournalFindUnique = vi.fn()
const mockPlanFindUnique = vi.fn()
const mockVenteFindUnique = vi.fn()
const mockAchatFindUnique = vi.fn()
const mockDepenseFindUnique = vi.fn()
const mockChargeFindUnique = vi.fn()
const mockReglementVenteFindUnique = vi.fn()
const mockReglementAchatFindUnique = vi.fn()
const mockValidate = vi.fn()

const mockVerifierCloture = vi.fn()
const mockDeleteEcritures = vi.fn()
const mockComptabiliserVente = vi.fn()
const mockComptabiliserAchat = vi.fn()
const mockComptabiliserDepense = vi.fn()
const mockComptabiliserCharge = vi.fn()
const mockComptabiliserReglementVente = vi.fn()
const mockComptabiliserReglementAchat = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    ecritureComptable: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    journal: { findUnique: (...args: unknown[]) => mockJournalFindUnique(...args) },
    planCompte: { findUnique: (...args: unknown[]) => mockPlanFindUnique(...args) },
    vente: { findUnique: (...args: unknown[]) => mockVenteFindUnique(...args) },
    achat: { findUnique: (...args: unknown[]) => mockAchatFindUnique(...args) },
    depense: { findUnique: (...args: unknown[]) => mockDepenseFindUnique(...args) },
    charge: { findUnique: (...args: unknown[]) => mockChargeFindUnique(...args) },
    reglementVente: { findUnique: (...args: unknown[]) => mockReglementVenteFindUnique(...args) },
    reglementAchat: { findUnique: (...args: unknown[]) => mockReglementAchatFindUnique(...args) },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: vi.fn(() => 1),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/validations', () => ({
  ecritureSchema: { partial: vi.fn(() => ({})) },
}))

vi.mock('@/lib/cloture', () => ({
  verifierCloture: (...args: unknown[]) => mockVerifierCloture(...args),
}))

vi.mock('@/lib/delete-ecritures', () => ({
  deleteEcrituresByReference: (...args: unknown[]) => mockDeleteEcritures(...args),
}))

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserVente: (...args: unknown[]) => mockComptabiliserVente(...args),
  comptabiliserAchat: (...args: unknown[]) => mockComptabiliserAchat(...args),
  comptabiliserDepense: (...args: unknown[]) => mockComptabiliserDepense(...args),
  comptabiliserCharge: (...args: unknown[]) => mockComptabiliserCharge(...args),
  comptabiliserReglementVente: (...args: unknown[]) => mockComptabiliserReglementVente(...args),
  comptabiliserReglementAchat: (...args: unknown[]) => mockComptabiliserReglementAchat(...args),
}))

import { getSession } from '@/lib/auth'

const { PATCH, DELETE } = await import('@/app/api/ecritures/[id]/route')

function mockReq(body?: any): any {
  return {
    nextUrl: new URL('http://localhost/api/ecritures/1'),
    json: vi.fn().mockResolvedValue(body || {}),
  }
}

function makeEcriture(overrides = {}) {
  return {
    id: 1, date: new Date('2026-06-01'), journalId: 1, piece: 'P001',
    libelle: 'Test écriture', compteId: 1, debit: 1000, credit: 0,
    reference: 'VENTE-1', referenceType: null, referenceId: null,
    entiteId: 1, utilisateurId: 1, creeLe: new Date(), misAjourLe: null,
    ...overrides,
  }
}

const defaultSession = { userId: 1, login: 'admin', nom: 'Admin', role: 'SUPER_ADMIN', entiteId: 1 }

describe('PATCH /api/ecritures/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockValidate.mockImplementation((_: any, data: any) => ({ success: true, data }))
    mockFindFirst.mockResolvedValue(makeEcriture())
    mockUpdate.mockResolvedValue(makeEcriture())
  })

  it('retourne 401 sans session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 403 sans permission', async () => {
    const { requirePermission } = await import('@/lib/require-role')
    vi.mocked(requirePermission).mockReturnValueOnce(new Response(null, { status: 403 }) as any)
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await PATCH(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si validation échoue', async () => {
    mockValidate.mockReturnValueOnce({
      success: false,
      response: new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 400 }),
    })
    const res = await PATCH(mockReq({ libelle: '' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si journal introuvable', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { journalId: 99 } })
    mockJournalFindUnique.mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({ journalId: 99 }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si compte introuvable', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { compteId: 99 } })
    mockPlanFindUnique.mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({ compteId: 99 }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si debit et credit sont tous deux à 0', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { debit: 0, credit: 0 } })
    const res = await PATCH(mockReq({ debit: 0, credit: 0 }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si debit et credit sont tous deux > 0', async () => {
    mockValidate.mockReturnValueOnce({ success: true, data: { debit: 500, credit: 500 } })
    const res = await PATCH(mockReq({ debit: 500, credit: 500 }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 si aucune donnée à mettre à jour', async () => {
    mockFindFirst.mockResolvedValueOnce(makeEcriture())
    const res = await PATCH(mockReq({}), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si écriture introuvable', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const res = await PATCH(mockReq({ libelle: 'Test' }), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 500 si vérification clôture échoue', async () => {
    mockVerifierCloture.mockRejectedValueOnce(new Error('VERROU DE CLOTURE'))
    const res = await PATCH(mockReq({ libelle: 'Test' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })

  it('met à jour une écriture avec succès', async () => {
    mockUpdate.mockResolvedValueOnce(makeEcriture({ libelle: 'Nouveau libellé' }))
    const res = await PATCH(mockReq({ libelle: 'Nouveau libellé' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.libelle).toBe('Nouveau libellé')
  })
})

describe('DELETE /api/ecritures/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockFindFirst.mockResolvedValue(makeEcriture())
    mockDelete.mockResolvedValue({ id: 1 })
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

  it('retourne 404 si écriture introuvable', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne 500 si vérification clôture échoue', async () => {
    mockVerifierCloture.mockRejectedValueOnce(new Error('VERROU DE CLOTURE'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })

  it('re-comptabilise après suppression si écriture liée à une vente', async () => {
    mockFindFirst.mockResolvedValueOnce(makeEcriture({ referenceType: 'VENTE', referenceId: 1 }))
    mockVenteFindUnique.mockResolvedValueOnce({
      id: 1, numero: 'V-001', date: new Date('2026-06-01'), montantTotal: 10000,
      modePaiement: 'ESPECES', clientId: 1, utilisateurId: 1, entiteId: 1,
      magasinId: 1, fraisApproche: 0,
      lignes: [{ produitId: 1, designation: 'Produit', quantite: 1, prixUnitaire: 10000, coutUnitaire: 5000, tva: 0, remise: 0 }],
      reglements: [{ modePaiement: 'ESPECES', montant: 10000 }],
    })
    mockDelete.mockResolvedValue({ id: 1 })
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(mockDeleteEcritures).toHaveBeenCalledWith('VENTE', 1)
    expect(mockComptabiliserVente).toHaveBeenCalled()
  })

  it('supprime une écriture sans reference avec succès', async () => {
    mockFindFirst.mockResolvedValueOnce(makeEcriture({ referenceType: null, referenceId: null }))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockDeleteEcritures).not.toHaveBeenCalled()
  })

  it('retourne 500 en cas d erreur serveur', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Erreur serveur'))
    const res = await DELETE(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})
