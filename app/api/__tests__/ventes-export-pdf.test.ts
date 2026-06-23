import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVenteFindMany = vi.hoisted(() => vi.fn())
const mockParamFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    vente: { findMany: mockVenteFindMany },
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

vi.mock('jspdf', () => {
  function MockJsPDF() {
    return {
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      setLineWidth: vi.fn(),
      text: vi.fn(),
      line: vi.fn(),
      rect: vi.fn(),
      addPage: vi.fn(),
      setPage: vi.fn(),
      internal: { pageSize: { height: 297, width: 210, getWidth: () => 210 }, pages: [1] },
      output: vi.fn(() => new ArrayBuffer(8)),
    }
  }
  return { default: MockJsPDF }
})

const { GET } = await import('../ventes/export-pdf/route')

function mockReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/ventes/export-pdf')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { nextUrl: url } as any
}

function makeVente(overrides = {}) {
  return {
    id: 1, numero: 'V20250001', numeroBon: null,
    date: '2026-06-01T10:00:00.000Z',
    montantTotal: 15000, montantPaye: 15000,
    modePaiement: 'ESPECES', statutPaiement: 'PAYE', statut: 'VALIDEE',
    client: { code: 'CL001', nom: 'Client Test' },
    clientLibre: null,
    magasin: { code: 'MAG01', nom: 'Magasin' },
    ...overrides,
  }
}

describe('GET /api/ventes/export-pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 sans session', async () => {
    const { getSession } = await import('@/lib/auth')
    vi.mocked(getSession).mockResolvedValueOnce(null as any)
    const res = await GET(mockReq())
    expect(res.status).toBe(401)
  })

  it('retourne un PDF avec le bon Content-Type', async () => {
    mockVenteFindMany.mockResolvedValue([makeVente()])
    mockParamFindFirst.mockResolvedValue({ nomEntreprise: 'Test SARL' })

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('.pdf')
  })

  it('accepte les paramètres dateDebut et dateFin', async () => {
    mockVenteFindMany.mockResolvedValue([])
    mockParamFindFirst.mockResolvedValue(null)

    const res = await GET(mockReq({ dateDebut: '2026-01-01', dateFin: '2026-06-30' }))
    expect(res.status).toBe(200)

    const [{ where }] = mockVenteFindMany.mock.calls[0]
    expect(where.date.gte).toBeDefined()
    expect(where.date.lte).toBeDefined()
  })

  it('retourne un PDF même avec 0 ventes', async () => {
    mockVenteFindMany.mockResolvedValue([])
    mockParamFindFirst.mockResolvedValue(null)

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('filtre par statut VALIDEE', async () => {
    mockVenteFindMany.mockResolvedValue([])
    mockParamFindFirst.mockResolvedValue(null)

    await GET(mockReq())

    const [{ where }] = mockVenteFindMany.mock.calls[0]
    expect(where.statut).toBe('VALIDEE')
  })

  it('retourne 500 en cas d\'erreur', async () => {
    mockVenteFindMany.mockRejectedValueOnce(new Error('DB down'))

    const res = await GET(mockReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('PDF')
  })
})
