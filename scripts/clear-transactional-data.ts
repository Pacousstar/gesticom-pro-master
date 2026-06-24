import { prisma } from '../lib/db'

const args = process.argv.slice(2)

async function checkData() {
  if (args.includes('--force')) return
  const [ventes, achats, ecritures] = await Promise.all([
    prisma.vente.count().catch(() => 0),
    prisma.achat.count().catch(() => 0),
    prisma.ecritureComptable.count().catch(() => 0),
  ])
  if (ventes + achats + ecritures > 0) {
    console.log('⚠️  ATTENTION: Ce script va SUPPRIMER toutes les transactions!')
    console.log(`   Ventes: ${ventes}, Achats: ${achats}, Écritures: ${ecritures}`)
    console.log('\nPour confirmer, ajoutez --force : npx tsx scripts/clear-transactional-data.ts --force')
    process.exit(1)
  }
}

await checkData()

async function main() {
  console.log('=== Nettoyage des données transactionnelles ===')
  console.log('Conserve : User, Magasin, Produit, Stock, Client, Fournisseur, Banque, PlanCompte, Journal, Parametre, Entite\n')

  // Ordre respectant les contraintes de clés étrangères
  const steps = [
    { name: 'RetourLigne',       action: () => prisma.retourLigne.deleteMany() },
    { name: 'Retour',            action: () => prisma.retour.deleteMany() },
    { name: 'VenteLigne',        action: () => prisma.venteLigne.deleteMany() },
    { name: 'Vente',             action: () => prisma.vente.deleteMany() },
    { name: 'AchatLigne',        action: () => prisma.achatLigne.deleteMany() },
    { name: 'Achat',             action: () => prisma.achat.deleteMany() },
    { name: 'ReglementVenteLigne', action: () => prisma.reglementVenteLigne.deleteMany() },
    { name: 'ReglementVente',    action: () => prisma.reglementVente.deleteMany() },
    { name: 'ReglementAchatLigne', action: () => prisma.reglementAchatLigne.deleteMany() },
    { name: 'ReglementAchat',    action: () => prisma.reglementAchat.deleteMany() },
    { name: 'TransfertLigne',    action: () => prisma.transfertLigne.deleteMany() },
    { name: 'Transfert',         action: () => prisma.transfert.deleteMany() },
    { name: 'MouvementCaisse',   action: () => prisma.caisse.deleteMany() },
    { name: 'Mouvement',         action: () => prisma.mouvement.deleteMany() },
    { name: 'OperationBancaire', action: () => prisma.operationBancaire.deleteMany() },
    { name: 'EcritureComptable', action: () => prisma.ecritureComptable.deleteMany() },
    { name: 'AuditLog',          action: () => prisma.auditLog.deleteMany() },
    { name: 'Charge',            action: () => prisma.charge.deleteMany() },
    { name: 'Depense',           action: () => prisma.depense.deleteMany() },
    { name: 'ArchiveVenteLigne', action: () => prisma.archiveVenteLigne.deleteMany() },
    { name: 'ArchiveVente',      action: () => prisma.archiveVente.deleteMany() },
    { name: 'ArchiveSoldeClient', action: () => prisma.archiveSoldeClient.deleteMany() },
    { name: 'CommandeFournisseurLigne', action: () => prisma.commandeFournisseurLigne.deleteMany() },
    { name: 'CommandeFournisseur', action: () => prisma.commandeFournisseur.deleteMany() },
    { name: 'SystemAlerte',      action: () => prisma.systemAlerte.deleteMany() },
  ]

  for (const step of steps) {
    try {
      const result = await step.action()
      console.log(`  ✓ ${step.name.padEnd(28)} ${result.count} ligne(s) supprimée(s)`)
    } catch (e: any) {
      console.error(`  ✗ ${step.name.padEnd(28)} ERREUR: ${e.message}`)
    }
  }

  console.log('\n=== Nettoyage terminé ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
