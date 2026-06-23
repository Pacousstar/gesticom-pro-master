import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/lib/__tests__/test-utils'

const mockData = {
  uptime: { seconds: 3600, human: '1h', startedAt: new Date().toISOString() },
  database: { sizeBytes: 1024, sizeHuman: '1 KB', path: '/data/db.sqlite' },
  errors: { total: 5, today: 1, logPath: '/logs' },
  activity: { ventesToday: 10, achatsToday: 3 },
  system: {
    users: 2, entities: 3,
    nodeVersion: 'v20.0.0', platform: 'win32', arch: 'x64',
    memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 157286400 },
    hostname: 'SRV-01', cpus: 4, uptime: '2j 3h',
  },
  app: { version: '3.42.5', environment: 'development' },
}

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le chargement puis le tableau de bord', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    expect(screen.getByText(/Chargement du monitoring/i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Monitoring')).toBeDefined()
    })

    expect(screen.getByText('v3.42.5 · development')).toBeDefined()
    expect(screen.getByText('1h')).toBeDefined()
    expect(screen.getByText('1 KB')).toBeDefined()
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('affiche les KPIs', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    await waitFor(() => {
      expect(screen.getByText('Uptime serveur')).toBeDefined()
    })

    expect(screen.getByText('Base de données')).toBeDefined()
    expect(screen.getAllByText('Erreurs').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Utilisateurs')).toBeDefined()
  })

  it('affiche les activités du jour', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    await waitFor(() => {
      expect(screen.getByText('Activité aujourd\'hui')).toBeDefined()
    })

    expect(screen.getByText('10')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })

  it('affiche les infos système', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    await waitFor(() => {
      expect(screen.getByText('Système')).toBeDefined()
    })

    expect(screen.getByText('v20.0.0')).toBeDefined()
    expect(screen.getByText(/win32.*x64/)).toBeDefined()
    expect(screen.getByText('4 cœurs')).toBeDefined()
  })

  it('affiche l\'écran d\'erreur si fetch échoue', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })

    expect(screen.getByText(/Réessayer/i)).toBeDefined()
  })

  it('permet de rafraîchir via le bouton Actualiser', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))

    const { default: MonitoringPage } = await import('@/app/(dashboard)/dashboard/monitoring/page')
    render(<MonitoringPage />)

    await waitFor(() => {
      expect(screen.getByText('Monitoring')).toBeDefined()
    })

    const refreshBtn = screen.getByText('Actualiser')
    expect(refreshBtn).toBeDefined()
  })
})
