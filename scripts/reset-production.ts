/**
 * Script de reset complet de la BD pour production
 * A exécuter APRÈS les tests
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const tablesToClean = [
  'archiveVenteLigne',
  'archiveVente',
  'archiveSoldeClient',
  'reglementVente',
  'venteLigne',
  'vente',
  'achatLigne',
  'achat',
  'depense',
  'charge',
  'stock',
  'produit',
  'client',
  'fournisseur',
  'mouvement',
  'operationBancaire',
  'ecritureComptable',
  'journal',
  'planCompte',
  'commandeFournisseurLigne',
  'commandeFournisseur',
  'systemAlerte',
  'caisse',
]

async function deleteTable(modelName: string, maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const prismaAny = prisma as any
      await prismaAny[modelName].deleteMany()
      return true
    } catch (e: any) {
      if (i === maxRetries - 1) {
        console.log(`   ⚠ ${modelName}: ${e.code || 'error'}`)
        return false
      }
      await new Promise(r => setTimeout(r, 100))
    }
  }
  return false
}

async function main() {
  console.log('========================================')
  console.log('RESET COMPLET BASE DE DONNEES')
  console.log('========================================\n')

  try {
    console.log('Suppression des donnees de test...\n')

    let deleted = 0
    for (const table of tablesToClean) {
      const ok = await deleteTable(table)
      if (ok) {
        console.log(`   ✓ ${table}`)
        deleted++
      }
    }

    console.log(`\n${deleted} tables vidées`)

    // Reset soldes caisses
    await prisma.magasin.updateMany({ data: { solderCaisse: 0 } })
    console.log('Soldes caisses reinitialises')

    // Reset Banque
    const banks = await prisma.banque.findMany()
    for (const b of banks) {
      await prisma.banque.update({
        where: { id: b.id },
        data: { solder: 0, solderActuel: 0 }
      })
    }
    console.log('Soldes bancaires reinitialises')

    console.log('\n========================================')
    console.log('BASE DE DONNEES VIDE!')
    console.log('========================================')
    console.log('\nL appli est prete pour la production.')
    console.log('Les donnees reelles seront creees via l interface.')

  } catch (error) {
    console.error('Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()