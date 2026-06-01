// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase, destroyTestDatabase, getDb } from './helpers'

let prisma: any

beforeAll(async () => {
  prisma = await createTestDatabase()
}, 60000)

afterAll(async () => {
  await destroyTestDatabase()
})

describe('Integration des produits', () => {
  it('a. Création et lecture d\'un produit', async () => {
    const created = await prisma.produit.create({
      data: {
        code: 'PROD001',
        designation: 'Produit Test',
        prixVente: 5000,
        prixAchat: 3000,
      }
    })

    expect(created.id).toBeGreaterThan(0)
    expect(created.code).toBe('PROD001')
    expect(created.designation).toBe('Produit Test')
    expect(created.prixVente).toBe(5000)
    expect(created.prixAchat).toBe(3000)
    expect(created.actif).toBe(true)
    expect(created.entiteId).toBe(1)

    const found = await prisma.produit.findUnique({
      where: { code: 'PROD001' }
    })

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.designation).toBe('Produit Test')
  })

  it('b. Mise à jour de stock', async () => {
    const product = await prisma.produit.create({
      data: { code: 'PROD-STOCK', designation: 'Stock Test', prixVente: 1000 }
    })

    const stock = await prisma.stock.create({
      data: { produitId: product.id, magasinId: 1, quantite: 100 }
    })

    expect(stock.quantite).toBe(100)

    const updated = await prisma.stock.update({
      where: { id: stock.id },
      data: { quantite: 75 }
    })

    expect(updated.quantite).toBe(75)

    const readBack = await prisma.stock.findUnique({
      where: { id: stock.id }
    })

    expect(readBack!.quantite).toBe(75)
  })

  it('c. Création d\'une vente avec lignes', async () => {
    const product = await prisma.produit.create({
      data: { code: 'PROD002', designation: 'Article Test', prixVente: 2500 }
    })

    const vente = await prisma.vente.create({
      data: {
        numero: 'V-2025-001',
        montantTotal: 5000,
        lignes: {
          create: [
            {
              produitId: product.id,
              designation: 'Article Test',
              quantite: 2,
              prixUnitaire: 2500,
              remise: 0,
              montant: 5000
            }
          ]
        }
      },
      include: { lignes: true }
    })

    expect(vente.numero).toBe('V-2025-001')
    expect(vente.montantTotal).toBe(5000)
    expect(vente.lignes).toHaveLength(1)
    expect(vente.lignes[0].quantite).toBe(2)
    expect(vente.lignes[0].montant).toBe(5000)
  })

  it('d. Cascade delete', async () => {
    const product = await prisma.produit.create({
      data: { code: 'PROD-CASCADE', designation: 'Cascade Test', prixVente: 1000 }
    })

    const vente = await prisma.vente.create({
      data: {
        numero: 'V-CASCADE-001',
        montantTotal: 2000,
        lignes: {
          create: [
            { produitId: product.id, designation: 'Ligne 1', quantite: 1, prixUnitaire: 1000, remise: 0, montant: 1000 },
            { produitId: product.id, designation: 'Ligne 2', quantite: 1, prixUnitaire: 1000, remise: 0, montant: 1000 }
          ]
        }
      }
    })

    const lignes = await prisma.venteLigne.findMany({ where: { venteId: vente.id } })
    expect(lignes).toHaveLength(2)

    await prisma.vente.delete({ where: { id: vente.id } })

    const lignesAfter = await prisma.venteLigne.findMany({ where: { venteId: vente.id } })
    expect(lignesAfter).toHaveLength(0)
    expect(await prisma.produit.count()).toBeGreaterThanOrEqual(1)
  })

  it('e. Création de ventes rapides et points fidélité', async () => {
    const product = await prisma.produit.create({
      data: { code: 'PROD-FID', designation: 'Fidélité Test', prixVente: 1000 }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-FID-001',
        montantTotal: 1000,
        estVenteRapide: true,
        pointsGagnes: 50,
        modePaiement: 'ESPECES',
        lignes: {
          create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 1000, remise: 0, montant: 1000 }]
        }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-FID-002',
        montantTotal: 2000,
        estVenteRapide: true,
        pointsGagnes: 100,
        modePaiement: 'ESPECES',
        lignes: {
          create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 2000, remise: 0, montant: 2000 }]
        }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-FID-003',
        montantTotal: 3000,
        estVenteRapide: false,
        pointsGagnes: 0,
        modePaiement: 'ESPECES',
        lignes: {
          create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 3000, remise: 0, montant: 3000 }]
        }
      }
    })

    const rapideCount = await prisma.vente.count({
      where: { estVenteRapide: true }
    })
    expect(rapideCount).toBe(2)

    const aggregation = await prisma.vente.aggregate({
      _sum: { pointsGagnes: true }
    })
    expect(aggregation._sum.pointsGagnes).toBe(150)
  })

  it('f. Filtrage et aggregation', async () => {
    const product = await prisma.produit.create({
      data: { code: 'PROD-AGG', designation: 'Agg Test', prixVente: 1000 }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-AGG-001',
        montantTotal: 10000,
        modePaiement: 'ESPECES',
        lignes: { create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 10000, remise: 0, montant: 10000 }] }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-AGG-002',
        montantTotal: 20000,
        modePaiement: 'CARTE',
        lignes: { create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 20000, remise: 0, montant: 20000 }] }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-AGG-003',
        montantTotal: 30000,
        modePaiement: 'ESPECES',
        lignes: { create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 30000, remise: 0, montant: 30000 }] }
      }
    })

    const sumResult = await prisma.vente.aggregate({
      where: { numero: { startsWith: 'V-AGG' } },
      _sum: { montantTotal: true },
      _avg: { montantTotal: true }
    })
    expect(sumResult._sum.montantTotal).toBe(60000)
    expect(sumResult._avg.montantTotal).toBe(20000)

    const especes = await prisma.vente.findMany({
      where: { modePaiement: 'ESPECES' }
    })
    expect(especes.length).toBeGreaterThanOrEqual(2)
  })
})
