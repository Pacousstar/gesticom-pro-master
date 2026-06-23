import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockCaisseDeleteMany = vi.fn()
const mockBanqueFindMany = vi.fn()
const mockBanqueUpdate = vi.fn()
const mockOperationDelete = vi.fn()
const mockLogSuppression = vi.fn()
const mockGetIpAddress = vi.fn().mockReturnValue('127.0.0.1')
const mockValidate = vi.fn()
const mockComptabiliserDepense = vi.fn()
const mockEnregistrerMouvement = vi.fn()
const mockRecalculerSolde = vi.fn()
const mockDeleteEcritures = vi.fn()
const mockVerifierCloture = vi.fn()

vi.mock('@/lib/db', () => {
  const p = {
    depense: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: vi.fn(),
    },
    magasin: {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      findFirst: vi.fn().mockResolvedValue({ id: 1 }),
    },
    caisse: { deleteMany: (...args: unknown[]) => mockCaisseDeleteMany(...args) },
    banque: {
      findMany: (...args: unknown[]) => mockBanqueFindMany(...args),
      update: (...args: unknown[]) => mockBanqueUpdate(...args),
    },
    operationBancaire: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: (...args: unknown[]) => mockOperationDelete(...args),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: Function) => {
      const result = cb(p)
      if (result instanceof Promise) return result
      return Promise.resolve(result)
    }),
  }
  return { prisma: p }
})

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn(() => undefined),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteIdOrAll: vi.fn(() => 1),
  getEntiteId: vi.fn(() => 1),
}))

vi.mock('@/lib/log-error', () => ({
  apiCatch: vi.fn(),
}))

vi.mock('@/lib/validation-helpers', () => ({
  validateApiRequest: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/validations', () => {
  const { z } = require('zod')
  return {
    depenseSchema: z.object({ libelle: z.string().optional(), montant: z.number().optional(), categorie: z.string().optional(), date: z.string().optional(), modePaiement: z.string().optional(), montantPaye: z.number().optional(), beneficiaire: z.string().optional().nullable(), pieceJustificative: z.string().optional().nullable(), observation: z.string().optional().nullable(), magasinId: z.number().optional() }),
  }
})

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserDepense: (...args: unknown[]) => mockComptabiliserDepense(...args),
}))

vi.mock('@/lib/caisse', () => ({
  enregistrerMouvementCaisse: (...args: unknown[]) => mockEnregistrerMouvement(...args),
  recalculerSoldeCaisse: (...args: unknown[]) => mockRecalculerSolde(...args),
}))

vi.mock('@/lib/enums-commerce', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    estModeEspeces: vi.fn((m: string) => m === 'ESPECES'),
    estModeBanque: vi.fn((m: string) => ['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(m)),
  }
})

vi.mock('@/lib/banque', () => ({
  enregistrerOperationBancaire: vi.fn(),
}))

vi.mock('@/lib/delete-ecritures', () => ({
  deleteEcrituresByReference: (...args: unknown[]) => mockDeleteEcritures(...args),
}))

vi.mock('@/lib/audit', () => ({
  logSuppression: (...args: unknown[]) => mockLogSuppression(...args),
  getIpAddress: (...args: unknown[]) => mockGetIpAddress(...args),
}))

vi.mock('@/lib/cloture', () => ({
  verifierCloture: (...args: unknown[]) => mockVerifierCloture(...args),
}))

import { getSession } from '@/lib/auth'

function createReq(body: unknown) {
  return {
    nextUrl: new URL('http://localhost/api/depenses/1'),
    json: () => Promise.resolve(body),
  } as any
}

function mockReq(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeDepense(overrides = {}) {
  return {
    id: 1, libelle: 'Fournitures bureau', montant: 75000, montantPaye: 75000,
    statutPaiement: 'PAYE', date: new Date('2026-06-21'), modePaiement: 'ESPECES',
    categorie: 'FOURNITURES', beneficiaire: 'Papeterie X',
    magasinId: 1, entiteId: 1, banqueId: null,
    magasin: { id: 1, code: 'M01', nom: 'Principal' },
    entite: { code: 'E01', nom: 'Entité 1' },
    utilisateur: { nom: 'Admin', login: 'admin' },
    observation: null, pieceJustificative: null,
    ...overrides,
  }
}

describe('PATCH /api/depenses/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const { PATCH } = await import('../depenses/[id]/route')
    const res = await PATCH(createReq({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 404 si dépense introuvable', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(null)
    const { PATCH } = await import('../depenses/[id]/route')
    const res = await PATCH(createReq({ libelle: 'Test' }), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('modifie une dépense avec succès', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(makeDepense())
    mockValidate.mockReturnValue({
      success: true,
      data: { montant: 80000, observation: 'Révisé' },
    })
    mockUpdate.mockResolvedValue(makeDepense({ montant: 80000, observation: 'Révisé' }))

    const { PATCH } = await import('../depenses/[id]/route')
    const res = await PATCH(createReq({ montant: 80000, observation: 'Révisé' }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.montant).toBe(80000)
    expect(mockDeleteEcritures).toHaveBeenCalled()
  })
})

describe('DELETE /api/depenses/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const { DELETE } = await import('../depenses/[id]/route')
    const res = await DELETE(createReq({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 403 si rôle insuffisant', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'USER', entiteId: 1 } as any)
    const { DELETE } = await import('../depenses/[id]/route')
    const res = await DELETE(createReq({}), mockReq('1'))
    expect(res.status).toBe(403)
  })

  it('retourne 400 si ID invalide', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    const { DELETE } = await import('../depenses/[id]/route')
    const res = await DELETE(createReq({}), mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('supprime une dépense avec succès', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN', entiteId: 1 } as any)
    mockFindUnique.mockResolvedValue(makeDepense())

    const { DELETE } = await import('../depenses/[id]/route')
    const res = await DELETE(createReq({}), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDeleteEcritures).toHaveBeenCalledWith('DEPENSE', 1, expect.anything())
    expect(mockLogSuppression).toHaveBeenCalled()
  })
})
