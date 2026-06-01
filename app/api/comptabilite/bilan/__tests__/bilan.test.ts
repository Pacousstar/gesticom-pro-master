import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBilanForYear } from '@/app/api/comptabilite/bilan/route'

const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    planCompte: {
      findMany: mockFindMany,
    },
  },
}))

function mockCompte(numero: string, libelle: string, ecritures: { debit: number; credit: number }[]) {
  return { numero, libelle, ecritures }
}

describe('getBilanForYear', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it('1. Bilan vide (aucun compte)', async () => {
    mockFindMany.mockResolvedValue([])
    const { bilan } = await getBilanForYear(1, 2025)
    expect(bilan.actif.immobilise.length).toBe(0)
    expect(bilan.actif.stocks.length).toBe(0)
    expect(bilan.actif.creances.length).toBe(0)
    expect(bilan.actif.tresorerie.length).toBe(0)
    expect(bilan.passif.capitaux.length).toBe(0)
    expect(bilan.passif.dettes.length).toBe(0)
    expect(bilan.passif.tresorerie.length).toBe(0)
    expect(bilan.actif.total).toBe(0)
    expect(bilan.passif.total).toBe(0)
  })

  it('2. Actif immobilisé (classe 2)', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('201', "Frais d'établissement", [{ debit: 500000, credit: 0 }]),
      mockCompte('215', 'Matériel', [{ debit: 3000000, credit: 0 }]),
      mockCompte('281', 'Amortissements', [{ debit: 0, credit: 800000 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    expect(bilan.actif.immobilise.length).toBe(3)
    expect(bilan.actif.immobilise.find((c: any) => c.numero === '201')?.montant).toBe(500000)
    expect(bilan.actif.immobilise.find((c: any) => c.numero === '215')?.montant).toBe(3000000)
    expect(bilan.actif.immobilise.find((c: any) => c.numero === '281')?.montant).toBe(800000)
    expect(bilan.actif.total).toBe(4300000)
  })

  it('3. Résultat net bénéficiaire', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('701', 'Ventes', [{ debit: 0, credit: 500000 }]),
      mockCompte('601', 'Achats', [{ debit: 200000, credit: 0 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    const resultat = bilan.passif.capitaux.find((c: any) => c.numero === '13')
    expect(resultat).toBeDefined()
    expect(resultat.libelle).toBe('RÉSULTAT NET : BÉNÉFICE')
    expect(resultat.montant).toBe(300000)
    expect(resultat.isResultat).toBe(true)
  })

  it('4. Résultat net déficitaire (perte)', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('701', 'Ventes', [{ debit: 100000, credit: 50000 }]),
      mockCompte('601', 'Achats', [{ debit: 200000, credit: 0 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    const resultat = bilan.passif.capitaux.find((c: any) => c.numero === '13')
    expect(resultat).toBeDefined()
    expect(resultat.libelle).toBe('RÉSULTAT NET : PERTE')
    expect(resultat.montant).toBe(250000)
  })

  it('5. Classe 4 split (créances/dettes)', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('401', 'Client', [{ debit: 150000, credit: 0 }]),
      mockCompte('404', 'Fournisseur', [{ debit: 0, credit: 75000 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    expect(bilan.actif.creances.length).toBe(1)
    expect(bilan.actif.creances[0].numero).toBe('401')
    expect(bilan.actif.creances[0].montant).toBe(150000)
    expect(bilan.passif.dettes.length).toBe(1)
    expect(bilan.passif.dettes[0].numero).toBe('404')
    expect(bilan.passif.dettes[0].montant).toBe(75000)
  })

  it('6. Classe 5 banques — overdraft handling', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('511', 'Banque', [{ debit: 200000, credit: 0 }]),
      mockCompte('512', 'Banque découvert', [{ debit: 0, credit: 30000 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    expect(bilan.actif.tresorerie.length).toBe(1)
    expect(bilan.actif.tresorerie[0].numero).toBe('511')
    expect(bilan.actif.tresorerie[0].montant).toBe(200000)
    expect(bilan.passif.tresorerie.length).toBe(1)
    expect(bilan.passif.tresorerie[0].numero).toBe('512')
    expect(bilan.passif.tresorerie[0].libelle).toBe('Banque découvert (découvert)')
    expect(bilan.passif.tresorerie[0].montant).toBe(30000)
  })

  it('7. Filter zeros', async () => {
    mockFindMany.mockResolvedValue([
      mockCompte('201', 'Immo zero', [{ debit: 500, credit: 500 }]),
      mockCompte('401', 'Client zero', [{ debit: 1000, credit: 1000 }]),
      mockCompte('201', 'Immo non zero', [{ debit: 10000, credit: 0 }]),
    ])
    const { bilan } = await getBilanForYear(1, 2025)
    expect(bilan.actif.immobilise.length).toBe(1)
    expect(bilan.actif.immobilise[0].libelle).toBe('Immo non zero')
    expect(bilan.actif.immobilise[0].montant).toBe(10000)
    expect(bilan.actif.creances.length).toBe(0)
  })
})
