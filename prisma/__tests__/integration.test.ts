// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase, destroyTestDatabase, getDb } from './helpers'

let prisma: any
let magasinId: number

beforeAll(async () => {
  prisma = await createTestDatabase()
  const magasin = await prisma.magasin.create({
    data: { code: 'MAG01', nom: 'Magasin Principal' }
  })
  magasinId = magasin.id
}, 120000)

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
      data: { produitId: product.id, magasinId, quantite: 100 }
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
        magasinId,
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
        magasinId,
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
        magasinId,
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
        magasinId,
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
        magasinId,
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
        magasinId,
        montantTotal: 10000,
        modePaiement: 'ESPECES',
        lignes: { create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 10000, remise: 0, montant: 10000 }] }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-AGG-002',
        magasinId,
        montantTotal: 20000,
        modePaiement: 'CARTE',
        lignes: { create: [{ produitId: product.id, designation: 'Test', quantite: 1, prixUnitaire: 20000, remise: 0, montant: 20000 }] }
      }
    })

    await prisma.vente.create({
      data: {
        numero: 'V-AGG-003',
        magasinId,
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

describe('Cycle 1: Vente → Paiement → Stock', () => {
  let clientId: number
  let produitId: number
  let stockId: number

  it('a. Création du client', async () => {
    const client = await prisma.client.create({
      data: { code: 'CLT001', nom: 'Client Test', telephone: '771234567', type: 'CASH' }
    })
    clientId = client.id
    expect(client.id).toBeGreaterThan(0)
    expect(client.nom).toBe('Client Test')
  })

  it('b. Création du produit et stock initial', async () => {
    const produit = await prisma.produit.create({
      data: { code: 'CYCLE1-PROD', designation: 'Article Cycle 1', prixVente: 2500, prixAchat: 1500 }
    })
    produitId = produit.id

    const stock = await prisma.stock.create({
      data: { produitId, magasinId, quantite: 50, quantiteInitiale: 50 }
    })
    stockId = stock.id
    expect(stock.quantite).toBe(50)
  })

  it('c. Création de la vente avec lignes', async () => {
    const vente = await prisma.vente.create({
      data: {
        numero: 'CYCLE1-V-001',
        magasinId,
        clientId,
        montantTotal: 12500,
        montantPaye: 0,
        statutPaiement: 'CREDIT',
        modePaiement: 'ESPECES',
        lignes: {
          create: [
            { produitId, designation: 'Article Cycle 1', quantite: 5, prixUnitaire: 2500, remise: 0, montant: 12500 }
          ]
        }
      },
      include: { lignes: true }
    })

    expect(vente.numero).toBe('CYCLE1-V-001')
    expect(vente.montantTotal).toBe(12500)
    expect(vente.montantPaye).toBe(0)
    expect(vente.statutPaiement).toBe('CREDIT')
    expect(vente.lignes).toHaveLength(1)
  })

  it('d. Déduction du stock (mouvement sortie)', async () => {
    const mouvement = await prisma.mouvement.create({
      data: {
        type: 'SORTIE',
        produitId,
        magasinId,
        quantite: -5,
        observation: 'Vente CYCLE1-V-001'
      }
    })

    expect(mouvement.type).toBe('SORTIE')
    expect(mouvement.quantite).toBe(-5)
    expect(mouvement.produitId).toBe(produitId)

    const stock = await prisma.stock.update({
      where: { id: stockId },
      data: { quantite: { decrement: 5 } }
    })

    expect(stock.quantite).toBe(45)
  })

  it('e. Encaissement du paiement', async () => {
    const vente = await prisma.vente.findUnique({ where: { numero: 'CYCLE1-V-001' } })

    const reglement = await prisma.reglementVente.create({
      data: {
        montant: 12500,
        modePaiement: 'ESPECES',
        clientId,
        venteId: vente!.id,
        ReglementVenteLigne: {
          create: [{ venteId: vente!.id, montant: 12500 }]
        }
      },
      include: { ReglementVenteLigne: true }
    })

    expect(reglement.montant).toBe(12500)
    expect(reglement.ReglementVenteLigne).toHaveLength(1)
    expect(reglement.ReglementVenteLigne[0].montant).toBe(12500)

    await prisma.vente.update({
      where: { id: vente!.id },
      data: { montantPaye: 12500, statutPaiement: 'PAYE' }
    })

    const venteAfter = await prisma.vente.findUnique({ where: { id: vente!.id } })
    expect(venteAfter!.montantPaye).toBe(12500)
    expect(venteAfter!.statutPaiement).toBe('PAYE')
    expect(venteAfter!.montantPaye).toBe(venteAfter!.montantTotal)
  })

  it('f. Vérification de cohérence globale', async () => {
    const stock = await prisma.stock.findUnique({ where: { id: stockId } })
    expect(stock!.quantite).toBe(45)

    const mouvements = await prisma.mouvement.findMany({
      where: { produitId, magasinId }
    })
    expect(mouvements).toHaveLength(1)
    expect(mouvements[0].quantite).toBe(-5)

    const reglements = await prisma.reglementVente.findMany({
      where: { clientId }
    })
    expect(reglements).toHaveLength(1)
    expect(reglements[0].montant).toBe(12500)
  })
})

describe('Cycle 2: Achat → Réception → PAMP', () => {
  let fournisseurId: number
  let produitId: number
  let stockId: number
  let achatId: number

  it('a. Création du fournisseur', async () => {
    const fournisseur = await prisma.fournisseur.create({
      data: { code: 'FOUR01', nom: 'Fournisseur Test', telephone: '771112233' }
    })
    fournisseurId = fournisseur.id
    expect(fournisseur.nom).toBe('Fournisseur Test')
  })

  it('b. Création du produit sans stock', async () => {
    const produit = await prisma.produit.create({
      data: { code: 'CYCLE2-PROD', designation: 'Article Cycle 2', prixVente: 4000, prixAchat: 0 }
    })
    produitId = produit.id
    expect(produit.pamp).toBe(0)
  })

  it('c. Création de l\'achat avec lignes', async () => {
    const achat = await prisma.achat.create({
      data: {
        numero: 'CYCLE2-A-001',
        magasinId,
        fournisseurId,
        montantTotal: 30000,
        fraisApproche: 2000,
        montantPaye: 0,
        statutPaiement: 'CREDIT',
        modePaiement: 'ESPECES',
        lignes: {
          create: [
            { produitId, designation: 'Article Cycle 2', quantite: 10, prixUnitaire: 3000, tva: 0, remise: 0, montant: 30000 }
          ]
        }
      },
      include: { lignes: true }
    })
    achatId = achat.id

    expect(achat.numero).toBe('CYCLE2-A-001')
    expect(achat.montantTotal).toBe(30000)
    expect(achat.fraisApproche).toBe(2000)
    expect(achat.lignes).toHaveLength(1)
    expect(achat.lignes[0].quantite).toBe(10)
    expect(achat.lignes[0].prixUnitaire).toBe(3000)
  })

  it('d. Réception: mouvement entrée + mise à jour stock + PAMP', async () => {
    const mouvement = await prisma.mouvement.create({
      data: {
        type: 'ENTREE',
        produitId,
        magasinId,
        quantite: 10,
        observation: 'Achat CYCLE2-A-001'
      }
    })
    expect(mouvement.type).toBe('ENTREE')
    expect(mouvement.quantite).toBe(10)

    const stock = await prisma.stock.create({
      data: { produitId, magasinId, quantite: 10, quantiteInitiale: 10 }
    })
    stockId = stock.id
    expect(stock.quantite).toBe(10)

    const ligne = (await prisma.achat.findUnique({ where: { id: achatId }, include: { lignes: true } }))!
    const coutUnitaire = (ligne.lignes[0].montant + 2000) / ligne.lignes[0].quantite
    const pamp = Math.round(coutUnitaire * 100) / 100

    await prisma.produit.update({
      where: { id: produitId },
      data: { pamp, prixAchat: pamp }
    })

    const produit = await prisma.produit.findUnique({ where: { id: produitId } })
    expect(produit!.pamp).toBe(pamp)
  })

  it('e. Paiement de l\'achat', async () => {
    const reglement = await prisma.reglementAchat.create({
      data: {
        montant: 32000,
        modePaiement: 'ESPECES',
        fournisseurId,
        achatId,
        ReglementAchatLigne: {
          create: [{ achatId, montant: 32000 }]
        }
      },
      include: { ReglementAchatLigne: true }
    })

    expect(reglement.montant).toBe(32000)
    expect(reglement.ReglementAchatLigne).toHaveLength(1)

    await prisma.achat.update({
      where: { id: achatId },
      data: { montantPaye: 32000, statutPaiement: 'PAYE' }
    })

    const achat = await prisma.achat.findUnique({ where: { id: achatId } })
    expect(achat!.montantPaye).toBe(32000)
    expect(achat!.statutPaiement).toBe('PAYE')
  })

  it('f. Vérification de cohérence globale', async () => {
    const stock = await prisma.stock.findUnique({ where: { id: stockId } })
    expect(stock!.quantite).toBe(10)

    const mouvements = await prisma.mouvement.findMany({
      where: { produitId, magasinId, type: 'ENTREE' }
    })
    expect(mouvements).toHaveLength(1)
    expect(mouvements[0].quantite).toBe(10)

    const reglements = await prisma.reglementAchat.findMany({
      where: { fournisseurId }
    })
    expect(reglements).toHaveLength(1)
    expect(reglements[0].montant).toBe(32000)
  })
})

describe('Cycle 3: Caisse → Banque → Lettrage', () => {
  let journalId: number
  let compteCaisseId: number
  let compteBanqueId: number
  let banqueId: number
  let ecritureId: number

  it('a. Création du journal et plans comptes', async () => {
    const journal = await prisma.journal.create({
      data: { code: 'BQ', libelle: 'Journal de Banque', type: 'BANQUE' }
    })
    journalId = journal.id
    expect(journal.code).toBe('BQ')

    const caisse = await prisma.planCompte.create({
      data: { numero: '571', libelle: 'Caisse', classe: '5', type: 'ACTIF' }
    })
    compteCaisseId = caisse.id
    expect(caisse.numero).toBe('571')

    const banque = await prisma.planCompte.create({
      data: { numero: '512', libelle: 'Banque', classe: '5', type: 'ACTIF' }
    })
    compteBanqueId = banque.id
    expect(banque.numero).toBe('512')
  })

  it('b. Création du compte banque et opération de dépôt', async () => {
    const banque = await prisma.banque.create({
      data: {
        numero: 'BNK001',
        nomBanque: 'Test Bank',
        libelle: 'Compte Principal',
        soldeInitial: 100000,
        soldeActuel: 100000
      }
    })
    banqueId = banque.id
    expect(banque.soldeActuel).toBe(100000)

    const operation = await prisma.operationBancaire.create({
      data: {
        banqueId,
        type: 'DEPOT',
        libelle: 'Dépôt espèces',
        montant: 50000,
        soldeAvant: 100000,
        soldeApres: 150000
      }
    })
    expect(operation.montant).toBe(50000)
    expect(operation.soldeApres).toBe(150000)

    await prisma.banque.update({
      where: { id: banqueId },
      data: { soldeActuel: 150000 }
    })
    const banqueApres = await prisma.banque.findUnique({ where: { id: banqueId } })
    expect(banqueApres!.soldeActuel).toBe(150000)
  })

  it('c. Opération de caisse (sortie pour dépôt banque)', async () => {
    const caisse = await prisma.caisse.create({
      data: {
        magasinId,
        type: 'SORTIE',
        motif: 'Dépôt en banque',
        montant: 50000,
        sousType: 'DEPOT_BANQUE'
      }
    })
    expect(caisse.type).toBe('SORTIE')
    expect(caisse.montant).toBe(50000)
    expect(caisse.sousType).toBe('DEPOT_BANQUE')
  })

  it('d. Écriture comptable (débit banque / crédit caisse)', async () => {
    const ecriture = await prisma.ecritureComptable.create({
      data: {
        numero: 'EC-CYCLE3-001',
        journalId,
        libelle: 'Dépôt espèces en banque',
        compteId: compteBanqueId,
        debit: 50000,
        credit: 0,
        reference: 'BNK001',
        referenceType: 'BANQUE',
        referenceId: banqueId
      }
    })
    ecritureId = ecriture.id
    expect(ecriture.debit).toBe(50000)
    expect(ecriture.credit).toBe(0)
    expect(ecriture.referenceType).toBe('BANQUE')

    const contrepartie = await prisma.ecritureComptable.create({
      data: {
        numero: 'EC-CYCLE3-002',
        journalId,
        libelle: 'Contrepartie dépôt espèces',
        compteId: compteCaisseId,
        debit: 0,
        credit: 50000,
        reference: 'BNK001',
        referenceType: 'BANQUE',
        referenceId: banqueId
      }
    })
    expect(contrepartie.credit).toBe(50000)
  })

  it('e. Vérification de l\'équilibre comptable', async () => {
    const ecritures = await prisma.ecritureComptable.findMany({
      where: { reference: 'BNK001' }
    })
    expect(ecritures).toHaveLength(2)

    const totalDebit = ecritures.reduce((s: number, e: any) => s + e.debit, 0)
    const totalCredit = ecritures.reduce((s: number, e: any) => s + e.credit, 0)
    expect(totalDebit).toBe(50000)
    expect(totalCredit).toBe(50000)
    expect(totalDebit).toBe(totalCredit)
  })

  it('f. Vérification de cohérence globale', async () => {
    const banque = await prisma.banque.findUnique({ where: { id: banqueId } })
    expect(banque!.soldeActuel).toBe(150000)

    const caisseOps = await prisma.caisse.findMany({
      where: { magasinId, type: 'SORTIE' }
    })
    expect(caisseOps.length).toBeGreaterThanOrEqual(1)
    expect(caisseOps[0].montant).toBe(50000)

    const opsBancaires = await prisma.operationBancaire.findMany({
      where: { banqueId }
    })
    expect(opsBancaires).toHaveLength(1)
    expect(opsBancaires[0].montant).toBe(50000)
  })
})
