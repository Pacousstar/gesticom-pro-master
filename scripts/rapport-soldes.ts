/**
 * Rapport des soldes clients et fournisseurs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('RAPPORT DES SOLDES - GESTICOM PRO')
  console.log('='.repeat(60) + '\n')

  try {
    const entite = await prisma.entite.findFirst()

    console.log('📋 SOLDES CLIENTS')
    console.log('-'.repeat(50))

    const clients = await prisma.client.findMany({ where: { entiteId: entite.id }, include: { ventes: true } })
    
    let totalCreances = 0
    let totalAvoir = 0

    for (const c of clients) {
      let creance = 0
      for (const v of c.ventes) {
        creance += (v.montantTotal - v.montantPaye)
      }
      
      if (creance > 0 || c.avoirInitial > 0) {
        console.log('\n' + c.nom)
        console.log('   Code: ' + (c.code || 'N/A'))
        console.log('   Type: ' + c.type)
        console.log('   Tel: ' + (c.telephone || 'N/A'))
        console.log('   Creance: ' + creance.toLocaleString() + ' F')
        console.log('   Avoir initial: ' + c.avoirInitial.toLocaleString() + ' F')
        console.log('   Plafond credit: ' + (c.plafondCredit ? c.plafondCredit.toLocaleString() + ' F' : 'N/A'))
        
        totalCreances += creance
        totalAvoir += c.avoirInitial || 0
      }
    }

    console.log('\n' + '-'.repeat(50))
    console.log('TOTAL CREANCES: ' + totalCreances.toLocaleString() + ' F')
    console.log('TOTAL AVOIRS: ' + totalAvoir.toLocaleString() + ' F')

    console.log('\n' + '='.repeat(60))
    console.log('📋 SOLDES FOURNISSEURS')
    console.log('-'.repeat(50))

    const fournisseurs = await prisma.fournisseur.findMany({ where: { entiteId: entite.id }, include: { achats: true } })
    
    let totalDettes = 0

    for (const f of fournisseurs) {
      let dette = 0
      for (const a of f.achats) {
        dette += (a.montantTotal - a.montantPaye)
      }
      
      if (dette > 0 || f.soldeInitial > 0) {
        console.log('\n' + f.nom)
        console.log('   Code: ' + (f.code || 'N/A'))
        console.log('   Tel: ' + (f.telephone || 'N/A'))
        console.log('   NCC: ' + (f.ncc || 'N/A'))
        console.log('   Dette: ' + dette.toLocaleString() + ' F')
        console.log('   Solde initial: ' + (f.soldeInitial || 0).toLocaleString() + ' F')
        
        totalDettes += dette
      }
    }

    console.log('\n' + '-'.repeat(50))
    console.log('TOTAL DETTES FOURNISSEURS: ' + totalDettes.toLocaleString() + ' F')

    console.log('\n' + '='.repeat(60))
    console.log('📊 RÉSUMÉ TIERS')
    console.log('-'.repeat(50))
    console.log('Creances clients: ' + totalCreances.toLocaleString() + ' F')
    console.log('Dettes fournisseurs: ' + totalDettes.toLocaleString() + ' F')
    console.log('Net tiers: ' + (totalCreances - totalDettes).toLocaleString() + ' F')

    console.log('\n' + '='.repeat(60))
    console.log('RAPPORT COMPLET')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()