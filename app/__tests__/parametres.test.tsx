import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/lib/__tests__/test-utils'

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}))

const mockParametres = {
  nomEntreprise: 'GestiCom Pro',
  slogan: 'Votre partenaire comptable',
  contact: '+221 77 123 45 67',
  email: 'contact@gesticom.sn',
  siteWeb: 'https://gesticom.sn',
  localisation: 'Dakar, Sénégal',
  numNCC: 'SN-2024-001',
  registreCommerce: 'RC-2024-001',
  devise: 'FCFA',
  tvaParDefaut: 18,
  fideliteActive: true,
  fideliteSeuilPoints: 100,
  fideliteTauxRemise: 5,
  modeInstallation: 'MODE_1',
  backupAuto: false,
}

const mockAuth = { role: 'SUPER_ADMIN', permissions: ['parametres:view'] }

const mockMagasins = [
  { id: 1, code: 'MAG-001', nom: 'Magasin Principal', localisation: 'Dakar', actif: true, creeLe: '2026-01-01', misAjourLe: '2026-06-01' },
]

const mockBackups = { backups: [{ name: 'backup-2026-06-01.sqlite', size: 1024, mtime: '2026-06-01' }] }

describe('ParametresPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le chargement puis les paramètres', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockParametres), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockAuth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockMagasins), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBackups), { status: 200 }))

    const { default: ParametresPage } = await import('@/app/(dashboard)/dashboard/parametres/page')
    render(<ParametresPage />)

    expect(screen.getByText(/Initialisation de la navigation sécurisée/i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Paramètres du Système')).toBeDefined()
    }, { timeout: 10000 })

    expect(screen.getByDisplayValue('GestiCom Pro')).toBeDefined()
    expect(screen.getByText('MAG-001')).toBeDefined()
    expect(screen.getByText('Magasin Principal')).toBeDefined()
  })

  it('affiche accès restreint pour role non autorisé', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockParametres), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ role: 'USER', permissions: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockMagasins), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBackups), { status: 200 }))

    const { default: ParametresPage } = await import('@/app/(dashboard)/dashboard/parametres/page')
    render(<ParametresPage />)

    await waitFor(() => {
      expect(screen.getByText('Accès restreint')).toBeDefined()
    }, { timeout: 10000 })
  })

  it('affiche accès restreint si backend est injoignable', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ role: 'USER', permissions: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockMagasins), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBackups), { status: 200 }))

    const { default: ParametresPage } = await import('@/app/(dashboard)/dashboard/parametres/page')
    render(<ParametresPage />)

    await waitFor(() => {
      expect(screen.getByText('Accès restreint')).toBeDefined()
    }, { timeout: 10000 })
  })

  it('affiche les sections de configuration', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockParametres), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockAuth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockMagasins), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBackups), { status: 200 }))

    const { default: ParametresPage } = await import('@/app/(dashboard)/dashboard/parametres/page')
    render(<ParametresPage />)

    await waitFor(() => {
      expect(screen.getByText("Identité de l'Entreprise")).toBeDefined()
    }, { timeout: 10000 })

    expect(screen.getByText('Fidélisation Client (PRO)')).toBeDefined()
    expect(screen.getByText('Documents & Impressions')).toBeDefined()
    expect(screen.getByText('Sauvegardes & Sûreté')).toBeDefined()
    expect(screen.getByText("Mode d'Installation")).toBeDefined()
    expect(screen.getByText('Gestion des Magasins & Entrepôts')).toBeDefined()
  })

  it('crée un magasin par défaut si la liste est vide', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(mockParametres), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockAuth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBackups), { status: 200 }))

    const { default: ParametresPage } = await import('@/app/(dashboard)/dashboard/parametres/page')
    render(<ParametresPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/magasins/ajout-defaut', expect.objectContaining({ method: 'POST' }))
    }, { timeout: 10000 })
  })
})
