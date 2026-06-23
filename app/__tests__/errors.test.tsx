import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/lib/__tests__/test-utils'

const mockErrors = [
  {
    timestamp: new Date().toISOString(),
    source: 'frontend',
    component: 'VentesPage',
    message: 'Erreur de chargement des ventes',
    stack: 'Error: Network error\n    at fetchData (webpack:...)\n    at async',
    level: 'error',
    url: '/dashboard/ventes',
    userAction: 'Chargement liste ventes',
    context: { endpoint: '/api/ventes', method: 'GET' },
  },
  {
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'app',
    message: 'Warning: deprecation',
    level: 'warning',
  },
  {
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    source: 'frontend',
    component: 'Dashboard',
    message: 'Info: mise à jour disponible',
    level: 'info',
  },
]

describe('ErrorsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le chargement puis la liste des erreurs', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockErrors), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    expect(screen.getByText(/Chargement des erreurs/i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("Moniteur d'Erreurs")).toBeDefined()
    })

    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Erreur de chargement des ventes')).toBeDefined()
    expect(screen.getByText(/Warning.*deprecation/)).toBeDefined()
    expect(screen.getByText(/Info.*mise à jour disponible/)).toBeDefined()
  })

  it('affiche le message vide si aucune erreur', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Aucune erreur')).toBeDefined()
    })
  })

  it('affiche le message vide si fetch échoue', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Aucune erreur')).toBeDefined()
    })
  })

  it('affiche les stat cards avec les bons compteurs', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockErrors), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText("Moniteur d'Erreurs")).toBeDefined()
    })

    expect(screen.getByText('Total')).toBeDefined()
    expect(screen.getByText('Erreurs')).toBeDefined()
    expect(screen.getByText('Avertissements')).toBeDefined()
  })

  it('filtre par niveau', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockErrors), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText("Moniteur d'Erreurs")).toBeDefined()
    })

    const filterToggle = screen.getByText('Filtres')
    filterToggle.click()

    await waitFor(() => {
      expect(screen.getByText('Tous')).toBeDefined()
    })
  })

  it('affiche la modale de confirmation pour tout effacer', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockErrors), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText("Moniteur d'Erreurs")).toBeDefined()
    })

    const clearBtn = screen.getByText('Tout effacer')
    clearBtn.click()

    await waitFor(() => {
      expect(screen.getByText('Effacer toutes les erreurs')).toBeDefined()
    })

    const cancelBtn = screen.getByText('Annuler')
    cancelBtn.click()

    await waitFor(() => {
      expect(screen.queryByText('Effacer toutes les erreurs')).toBeNull()
    })
  })

  it('développe les détails d une erreur au clic', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockErrors), { status: 200 }))

    const { default: ErrorsPage } = await import('@/app/(dashboard)/dashboard/errors/page')
    render(<ErrorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Erreur de chargement des ventes')).toBeDefined()
    })

    const errorRow = screen.getByText('Erreur de chargement des ventes')
    errorRow.click()

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeDefined()
    })

    expect(screen.getByText('Horodatage')).toBeDefined()
    expect(screen.getByText('Stack Trace')).toBeDefined()
    expect(screen.getByText('Contexte')).toBeDefined()
    expect(screen.getByText('URL')).toBeDefined()
  })
})
