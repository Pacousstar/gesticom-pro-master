import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@/lib/__tests__/test-utils'

const mockLicenceActive = {
  active: true,
  statut: 'ACTIVE',
  clientNom: 'Client Test',
  debutValidite: '2026-01-01T00:00:00.000Z',
  features: ['all'],
}

const mockLicenceAbsente = {
  active: false,
  statut: 'ABSENTE',
  features: [],
}

describe('LicencePage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le spinner pendant le chargement', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeDefined()
  })

  it('affiche les infos licence active', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceActive), { status: 200 }))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    await waitFor(() => {
      expect(screen.getByText('Licence')).toBeDefined()
    })

    expect(screen.getByText('Active')).toBeDefined()
    expect(screen.getByText('Client Test')).toBeDefined()
    expect(screen.getByText(/Perpétuelle/)).toBeDefined()
  })

  it('affiche licence absente', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceAbsente), { status: 200 }))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    await waitFor(() => {
      expect(screen.getByText('Non installée')).toBeDefined()
    })
  })

  it('permet de saisir une clé de licence', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceActive), { status: 200 }))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    await waitFor(() => {
      expect(screen.getByText(/Activer une licence/i)).toBeDefined()
    })

    const input = screen.getByPlaceholderText(/Collez votre clé/i)
    expect(input).toBeDefined()

    fireEvent.change(input, { target: { value: 'TEST-KEY-123' } })
    expect((input as HTMLInputElement).value).toBe('TEST-KEY-123')

    const btn = screen.getByText('Activer')
    expect(btn).toBeDefined()
  })

  it('active une licence avec succès', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceAbsente), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Licence activée avec succès' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceActive), { status: 200 }))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    await waitFor(() => {
      expect(screen.getByText('Non installée')).toBeDefined()
    })

    const input = screen.getByPlaceholderText(/Collez votre clé/i)
    fireEvent.change(input, { target: { value: 'VALID-KEY' } })

    const btn = screen.getByText('Activer')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Licence activée avec succès/i)).toBeDefined()
    })
  })

  it('affiche une erreur si activation échoue', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockLicenceAbsente), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Clé invalide' }), { status: 400 }))

    const { default: LicencePage } = await import('@/app/(dashboard)/dashboard/licence/page')
    render(<LicencePage />)

    await waitFor(() => {
      expect(screen.getByText('Non installée')).toBeDefined()
    })

    const input = screen.getByPlaceholderText(/Collez votre clé/i)
    fireEvent.change(input, { target: { value: 'INVALID-KEY' } })

    const btn = screen.getByText('Activer')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Clé invalide')).toBeDefined()
    })
  })
})
