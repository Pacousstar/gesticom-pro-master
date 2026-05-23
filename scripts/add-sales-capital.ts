/**
 * Script: Ajouter Capital + Plus de Ventes pour equilibrer bilan
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Ajustement donnees...\n')

  try {
    const entite = await prisma.entite.findFirst()
    const magasin = await prisma.magasin.findFirst({ where: { entiteId: entite.id } })
    const admin = await prisma.utilisateur.findFirst({ where: { role: 'SUPER_ADMIN' } })
    const products = await prisma.produit.findMany({ where: { entiteId: entite.id } })
    const stocks = await prisma.stock.findMany({ where: { entiteId: entite.id }, include: { produit: true } })
    const clients = await prisma.client.findMany({ where: { entiteId: entite.id } })

    console.log('1. Augmenter capital (apport initiale)...')
    const banks = await prisma.banque.findMany({ where: { entiteId: entite.id } })
    if (banks.length > 0) {
      await prisma.banque.update({
        where: { id: banks[0].id },
        data: { soldeInitial: 10000000 }
      })
      console.log('   Capital passe a 10,000,000 F')
    }

    console.log('\n2. Ajouter nouvelles ventes rentables...')
    
    // Sale 1 - Big sale with profits
    const p1 = products.find(p => p.code === 'PAR001')
    const p2 = products.find(p => p.code === 'PAR002') 
    const p3 = products.find(p => p.code === 'PAR003')
    const r1 = products.find(p => p.code === 'RIZ001')
    
    if (p1 && p2) {
      const v6 = await prisma.vente.create({
        data: { numero: 'VEN-006', date: new Date('2026-03-01'), montantTotal: 2500000, montantPaye: 2500000, statut: 'VALIDEE', statutPaiement: 'PAYE', modePaiement: 'VIREMENT', clientId: clients[0].id, entiteId: entite.id, magasinId: magasin.id, utilisateurId: admin.id }
      })
      await prisma.venteLigne.create({ data: { venteId: v6.id, produitId: p1.id, designation: p1.designation, quantite: 50, prixUnitaire: 25000, tva: 18, montant: 1475000 } })
      await prisma.venteLigne.create({ data: { venteId: v6.id, produitId: p2.id, designation: p2.designation, quantite: 50, prixUnitaire: 15000, tva: 18, montant: 885000 } })
      console.log('   VEN-006: 2,500,000 F (profitable)')
    }

    if (p3 && clients[1]) {
      const v7 = await prisma.vente.create({
        data: { numero: 'VEN-007', date: new Date('2026-03-05'), montantTotal: 3000000, montantPaye: 3000000, statut: 'VALIDEE', statutPaiement: 'PAYE', modePaiement: 'ESPECES', clientId: clients[1].id, entiteId: entite.id, magasinId: magasin.id, utilisateurId: admin.id }
      })
      await prisma.venteLigne.create({ data: { venteId: v7.id, produitId: p3.id, designation: p3.designation, quantite: 80, prixUnitaire: 25000, tva: 18, montant: 2360000 } })
      await prisma.venteLigne.create({ data: { venteId: v7.id, produitId: r1.id, designation: r1.designation, quantite: 20, prixUnitaire: 32000, tva: 18, montant: 755200 } })
      console.log('   VEN-007: 3,000,000 F (profitable)')
    }

    if (r1 && clients[2]) {
      const v8 = await prisma.vente.create({
        data: { numero: 'VEN-008', date: new Date('2026-03-10'), montantTotal: 4000000, montantPaye: 4000000, statut: 'VALIDEE', statutPaiement: 'PAYE', modePaiement: 'VIREMENT', clientId: clients[2].id, entiteId: entite.id, magasinId: magasin.id, utilisateurId: admin.id }
      })
      await prisma.venteLigne.create({ data: { venteId: v8.id, produitId: r1.id, designation: r1.designation, quantite: 100, prixUnitaire: 40000, tva: 18, montant: 4720000 } })
      console.log('   VEN-008: 4,000,000 F (tres profitable)')
    }

    // Decrement stocks
    const stockDecs6 = [
      { pid: p1.id, d: 50 },
      { pid: p2.id, d: 50 },
      { pid: p3.id, d: 80 },
      { pid: r1.id, d: 120 }
    ]
    for (const s of stockDecs6) {
      await prisma.stock.updateMany({
        where: { produitId: s.pid, magasinId: magasin.id },
        data: { quantite: { decrement: s.d } }
      })
    }
    console.log('   Stocks decrements')

    console.log('\n3. Ajouter charges supplementaires...')
    await prisma.charge.create({ data: { date: new Date('2026-03-01'), observation: 'Loyer Mars', montant: 350000, statut: 'VALIDE', modePaiement: 'VIREMENT', type: 'CHARGE_FIXE', entiteId: entite.id, utilisateurId: admin.id, rubsrique: 'LOYER' } })
    await prisma.charge.create({ data: { date: new Date('2026-03-05'), observation: 'Salaire Mars', montant: 150000, statut: 'VALIDE', modePaiement: 'VIREMENT', type: 'CHARGE_FIXE', entiteId: entite.id, utilisateurId: admin.id, rubsrique: 'SALAIRE' } })
    console.log('   Charges ajoutees')

    console.log('\n=====================================')
    console.log('DONNEES AJOUTEES AVEC SUCCES!')
    console.log('=====================================')

  } catch (error) {
    console.error('Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()