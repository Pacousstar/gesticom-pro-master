import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    parametre: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockSession = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockSession(...args),
}))

function createRequest(method: string, body?: unknown) {
  return {
    json: async () => body,
  } as any
}

describe('GET /api/parametres/mode-installation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne le mode par défaut si aucun paramètre', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue(null)

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_1')
  })

  it('retourne le mode stocké', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ modeInstallation: 'MODE_2' })

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_2')
  })

  it('retourne 401 si non connecté', async () => {
    mockSession.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()

    expect(res.status).toBe(401)
  })
})

describe('PUT /api/parametres/mode-installation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour le mode', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ id: 1, modeInstallation: 'MODE_1' })
    mockUpdate.mockResolvedValue({ modeInstallation: 'MODE_3' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_3' })
    const res = await PUT(req)
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_3')
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { modeInstallation: 'MODE_3' },
    })
  })

  it('rejette un mode invalide', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_4' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
  })

  it('rejette si rôle insuffisant', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'GESTIONNAIRE' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_2' })
    const res = await PUT(req)

    expect(res.status).toBe(403)
  })
})
