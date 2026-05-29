/**
 * Script de déploiement GestiCom Pro
 * 
 * Usage:
 *   npx tsx scripts/deploy.ts          → Mise à jour (migrate + seed)
 *   npx tsx scripts/deploy.ts --reset  → Reset complet + seed (NOUVEAU CLIENT)
 * 
 * --reset supprime TOUTES les données et réinitialise.
 * Sans --reset, les données existantes sont préservées.
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const isReset = args.includes('--reset')

function run(cmd: string) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
}

async function main() {
  console.log('========================================')
  console.log(isReset ? 'NOUVEAU CLIENT - RESET COMPLET' : 'MISE À JOUR CLIENT EXISTANT')
  console.log('========================================')

  // 1. Appliquer les migrations (toujours, sans risque)
  console.log('\n--- Étape 1 : Migration du schéma ---')
  run('npx prisma migrate deploy')

  // 2. Reset si demandé (NOUVEAU CLIENT)
  if (isReset) {
    console.log('\n--- Étape 2 : Reset des données ---')
    const tables = [
      'archiveVenteLigne', 'archiveVente', 'archiveSoldeClient',
      'reglementAchatLigne', 'reglementAchat', 'reglementVenteLigne', 'reglementVente',
      'venteLigne', 'vente', 'achatLigne', 'achat',
      'commandeFournisseurLigne', 'commandeFournisseur',
      'transfertLigne', 'transfert',
      'mouvement', 'stock',
      'depense', 'charge',
      'operationBancaire', 'banque',
      'caisse',
      'ecritureComptable', 'journal', 'planCompte',
      'systemAlerte', 'auditLog',
      'produit', 'client', 'fournisseur',
      'parametre', 'magasin',
      'notification',
    ]

    for (const table of tables) {
      try {
        await (prisma as any)[table].deleteMany()
        console.log(`  ✓ ${table}`)
      } catch {
        console.log(`  - ${table} (ignoré)`)
      }
    }

    // Réinitialiser soldes caisses
    await prisma.magasin.updateMany({ data: { solderCaisse: 0 } })
    console.log('  ✓ Soldes caisses réinitialisés')

    // Réinitialiser soldes banques
    await prisma.banque.updateMany({ data: { solder: 0, solderActuel: 0 } })
    console.log('  ✓ Soldes banques réinitialisés')

    // Réinitialiser les paramètres généraux
    await prisma.parametre.deleteMany()
    console.log('  ✓ Paramètres supprimés')

    console.log('\n  ✅ Toutes les données supprimées.')
  }

  // 3. Seed (crée admin/magasin/entité si absents)
  console.log('\n--- Étape 3 : Seed ---')
  run('node scripts/seed.js')

  console.log('\n========================================')
  console.log('✅ Déploiement terminé avec succès !')
  console.log(isReset
    ? 'Nouveau client prêt. Connectez-vous avec admin / Admin@123'
    : 'Mise à jour appliquée. Données préservées.')
  console.log('========================================')
}

main()
  .catch((e) => {
    console.error('\n❌ Erreur de déploiement:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
