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
const mockComptabiliserCharge = vi.fn()
const mockEnregistrerMouvement = vi.fn()
const mockRecalculerSolde = vi.fn()
const mockDeleteEcritures = vi.fn()
const mockVerifierCloture = vi.fn()

vi.mock('@/lib/db', () => {
  const p = {
    charge: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: vi.fn(),
    },
    magasin: { findUnique: vi.fn().mockResolvedValue({ id: 1, code: 'M01', nom: 'Principal' }), findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
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
    chargeSchema: z.object({ rubrique: z.string().optional(), montant: z.number().optional(), type: z.string().optional(), date: z.string().optional(), beneficiaire: z.string().optional().nullable(), magasinId: z.number().optional(), observation: z.string().optional().nullable(), modePaiement: z.string().optional(), banqueId: z.number().optional().nullable() }),
  }
})

vi.mock('@/lib/comptabilisation', () => ({
  comptabiliserCharge: (...args: unknown[]) => mockComptabiliserCharge(...args),
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
import { PATCH, DELETE } from '@/app/api/charges/[id]/route'

const defaultSession = { userId: 1, role: 'SUPER_ADMIN', entiteId: 1 }

function createReq(body: unknown) {
  return {
    nextUrl: new URL('http://localhost/api/charges/1'),
    json: () => Promise.resolve(body),
  } as any
}

function mockReq(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeCharge(overrides = {}) {
  return {
    id: 1, rubrique: 'Loyer', montant: 500000, type: 'FIXE',
    date: new Date('2026-06-01'), modePaiement: 'ESPECES',
    beneficiaire: null, observation: 'Local principal',
    magasinId: 1, entiteId: 1, banqueId: null,
    magasin: { id: 1, code: 'M01', nom: 'Principal' },
    entite: { code: 'E01', nom: 'Entité 1' },
    utilisateur: { nom: 'Admin', login: 'admin' },
    ...overrides,
  }
}

describe('PATCH /api/charges/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockGetIpAddress.mockReturnValue('127.0.0.1')
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PATCH(createReq({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 404 si charge introuvable', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await PATCH(createReq({ rubrique: 'Test' }), mockReq('999'))
    expect(res.status).toBe(404)
  })

  it('retourne 400 si aucune donnée', async () => {
    mockFindUnique.mockResolvedValue(makeCharge())
    mockValidate.mockReturnValue({ success: true, data: {} })
    const res = await PATCH(createReq({}), mockReq('1'))
    expect(res.status).toBe(400)
  })

  it('modifie une charge avec succès', async () => {
    mockFindUnique.mockResolvedValue(makeCharge())
    mockValidate.mockReturnValue({
      success: true,
      data: { montant: 600000, observation: 'Révisé' },
    })
    mockUpdate.mockResolvedValue(makeCharge({ montant: 600000, observation: 'Révisé' }))

    const res = await PATCH(createReq({ montant: 600000, observation: 'Révisé' }), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.montant).toBe(600000)
    expect(mockDeleteEcritures).toHaveBeenCalled()
    expect(mockComptabiliserCharge).toHaveBeenCalled()
  })
})

describe('DELETE /api/charges/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue(defaultSession as any)
    mockGetIpAddress.mockReturnValue('127.0.0.1')
  })

  it('retourne 401 si non authentifié', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await DELETE(createReq({}), mockReq('1'))
    expect(res.status).toBe(401)
  })

  it('retourne 403 si rôle insuffisant', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 1, role: 'USER', entiteId: 1 } as any)
    const res = await DELETE(createReq({}), mockReq('1'))
    expect(res.status).toBe(403)
  })

  it('retourne 400 si ID invalide', async () => {
    const res = await DELETE(createReq({}), mockReq('abc'))
    expect(res.status).toBe(400)
  })

  it('supprime une charge avec succès', async () => {
    mockFindUnique.mockResolvedValue(makeCharge())

    const res = await DELETE(createReq({}), mockReq('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDeleteEcritures).toHaveBeenCalledWith('CHARGE', 1, expect.anything())
    expect(mockLogSuppression).toHaveBeenCalled()
  })
})
