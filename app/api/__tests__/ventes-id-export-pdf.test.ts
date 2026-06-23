import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVenteFindUnique = vi.hoisted(() => vi.fn())
const mockParamFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    vente: { findUnique: mockVenteFindUnique },
    parametre: { findFirst: mockParamFindFirst },
  },
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 1, role: 'SUPER_ADMIN' }),
}))

vi.mock('@/lib/require-role', () => ({
  requirePermission: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/get-entite-id', () => ({
  getEntiteId: vi.fn().mockResolvedValue(1),
}))

const { GET } = await import('../ventes/[id]/export-pdf/route')

function mockReq(): any {
  return { nextUrl: new URL('http://localhost/api/ventes/1/export-pdf') } as any
}

function makeVente(overrides = {}) {
  return {
    id: 1, numero: 'V20250001',
    date: new Date('2026-06-01'),
    montantTotal: 15000, montantPaye: 15000,
    modePaiement: 'ESPECES', statutPaiement: 'PAYE', statut: 'VALIDEE',
    remiseGlobale: null, observation: null,
    client: null, clientLibre: 'Client Libre',
    magasin: { code: 'MAG01', nom: 'Magasin' },
    lignes: [
      { designation: 'Article 1', quantite: 2, prixUnitaire: 5000, remise: 0, tva: 0, montant: 10000, produit: { designation: 'Art 1' } },
    ],
    utilisateur: { nom: 'Admin' },
    ...overrides,
  }
}

describe('GET /api/ventes/[id]/export-pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('retourne 400 pour ID invalide', async () => {
    const res = await GET(mockReq(), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 400 pour ID négatif', async () => {
    const res = await GET(mockReq(), { params: Promise.resolve({ id: '-1' }) })
    expect(res.status).toBe(400)
  })

  it('retourne 404 si vente introuvable', async () => {
    mockVenteFindUnique.mockResolvedValue(null)
    const res = await GET(mockReq(), { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('retourne un PDF avec les données de la vente', async () => {
    mockVenteFindUnique.mockResolvedValue(makeVente())
    mockParamFindFirst.mockResolvedValue({ nomEntreprise: 'Test SARL' })

    const res = await GET(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('facture-V20250001.pdf')
  })

  it('retourne 500 en cas d\'erreur', async () => {
    mockVenteFindUnique.mockRejectedValueOnce(new Error('DB down'))

    const res = await GET(mockReq(), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
  })
})
