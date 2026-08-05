import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

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

const mockAutoInstall = vi.fn()

vi.mock('@/lib/auto-install', () => ({
  autoInstallPostgres: (...args: unknown[]) => mockAutoInstall(...args),
}))

function createRequest(method: string, body?: unknown) {
  return {
    json: async () => body,
  } as any
}

let tmpDir = ''

describe('GET /api/parametres/mode-installation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retourne le mode par défaut si aucune config', async () => {
    vi.stubEnv('GESTICOM_USER_DATA', os.tmpdir())
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue(null)

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_1')
  })

  it('retourne le mode stocké si pas de config.json', async () => {
    vi.stubEnv('GESTICOM_USER_DATA', os.tmpdir())
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ modeInstallation: 'MODE_2' })

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_2')
  })

  it('retourne le mode de config.json en priorité', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gesticom-mode-test-'))
    vi.stubEnv('GESTICOM_USER_DATA', tmpDir)
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ mode: 'MODE_3', postgres: {} }))
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ modeInstallation: 'MODE_1' })

    const { GET } = await import('@/app/api/parametres/mode-installation/route')
    const res = await GET()
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_3')
    expect(data.isCurrentPostgres).toBe(true)
  })

  it('retourne 401 si non connecté', async () => {
    vi.stubEnv('GESTICOM_USER_DATA', os.tmpdir())
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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gesticom-mode-test-'))
    vi.stubEnv('GESTICOM_USER_DATA', tmpDir)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('met à jour le mode MODE_1 dans la base et config.json', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ id: 1, modeInstallation: 'MODE_3' })
    mockUpdate.mockResolvedValue({ modeInstallation: 'MODE_1' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_1' })
    const res = await PUT(req)
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_1')
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { modeInstallation: 'MODE_1' },
    })
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.mode).toBe('MODE_1')
  })

  it('met à jour le mode MODE_2 avec les creds PostgreSQL', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ id: 1, modeInstallation: 'MODE_1' })
    mockUpdate.mockResolvedValue({ modeInstallation: 'MODE_2' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', {
      modeInstallation: 'MODE_2',
      postgres: { host: 'localhost', port: 5432, database: 'gesticom', user: 'gesticom', password: 'gesticom123' },
    })
    const res = await PUT(req)
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_2')
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.mode).toBe('MODE_2')
    expect(config.postgres.host).toBe('localhost')
    expect(config.postgres.password).toBe('gesticom123')
  })

  it('rejette MODE_2 sans mot de passe PostgreSQL', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_2' })
    const res = await PUT(req)

    expect(res.status).toBe(400)
    expect(mockAutoInstall).not.toHaveBeenCalled()
  })

  it('installe PostgreSQL automatiquement pour MODE_3', async () => {
    mockAutoInstall.mockResolvedValue({
      host: 'localhost',
      port: 5432,
      database: 'gesticom',
      user: 'gesticom',
      password: 'gesticom123',
    })
    mockSession.mockResolvedValue({ userId: 1, role: 'ADMIN' })
    mockFindFirst.mockResolvedValue({ id: 1, modeInstallation: 'MODE_1' })
    mockUpdate.mockResolvedValue({ modeInstallation: 'MODE_3' })

    const { PUT } = await import('@/app/api/parametres/mode-installation/route')
    const req = createRequest('PUT', { modeInstallation: 'MODE_3', autoInstall: true })
    const res = await PUT(req)
    const data = await res.json()

    expect(data.modeInstallation).toBe('MODE_3')
    expect(mockAutoInstall).toHaveBeenCalled()
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(config.mode).toBe('MODE_3')
    expect(config.postgres.password).toBe('gesticom123')
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
