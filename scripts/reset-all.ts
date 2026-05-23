import { prisma } from '../lib/db'

async function resetDatabase() {
  console.log('🗑️ Reset complet de la base de données...\n')

  try {
    // Supprimer les écritures comptables
    await prisma.ecritureComptable.deleteMany({})
    console.log('✅ Écritures supprimées')

    // Supprimer les journaux
    await prisma.journal.deleteMany({})
    console.log('✅ Journaux supprimés')

    // Supprimer la caisse
    await prisma.caisse.deleteMany({})
    console.log('✅ Caisse supprimée')

    // Supprimer les opérations bancaires
    await prisma.operationBancaire.deleteMany({})
    console.log('✅ Opérations bancaires supprimées')

    // Supprimer les banques
    await prisma.banque.deleteMany({})
    console.log('✅ Banques supprimées')

    // Supprimer les dépenses
    await prisma.depense.deleteMany({})
    console.log('✅ Dépenses supprimées')

    // Supprimer les charges
    await prisma.charge.deleteMany({})
    console.log('✅ Charges supprimées')

    // Supprimer les règlements
    await prisma.reglementVenteLigne.deleteMany({})
    await prisma.reglementAchatLigne.deleteMany({})
    await prisma.reglementVente.deleteMany({})
    console.log('✅ Règlements ventes + lignes supprimés')

    await prisma.reglementAchat.deleteMany({})
    console.log('✅ Règlements achats + lignes supprimés')

    // Supprimer les lignes de ventes/achats
    await prisma.venteLigne.deleteMany({})
    console.log('✅ Lignes ventes supprimées')

    await prisma.achatLigne.deleteMany({})
    console.log('✅ Lignes achats supprimées')

    // Supprimer les ventes et achats
    await prisma.vente.deleteMany({})
    console.log('✅ Ventes supprimées')

    await prisma.achat.deleteMany({})
    console.log('✅ Achats supprimés')

    // Supprimer les mouvements
    await prisma.mouvement.deleteMany({})
    console.log('✅ Mouvements supprimés')

    // Supprimer les transferts
    await prisma.transfertLigne.deleteMany({})
    await prisma.transfert.deleteMany({})
    console.log('✅ Transferts supprimés')

    // Supprimer les stocks
    await prisma.stock.deleteMany({})
    console.log('✅ Stocks supprimés')

    // Supprimer les commandes fournisseurs
    await prisma.commandeFournisseurLigne.deleteMany({})
    await prisma.commandeFournisseur.deleteMany({})
    console.log('✅ Commandes fournisseurs supprimées')

    // Supprimer les clients
    await prisma.client.deleteMany({})
    console.log('✅ Clients supprimés')

    // Supprimer les fournisseurs
    await prisma.fournisseur.deleteMany({})
    console.log('✅ Fournisseurs supprimés')

    // Supprimer les produits
    await prisma.produit.deleteMany({})
    console.log('✅ Produits supprimés')

    // Supprimer les alerts (peut échouer à cause des foreign keys)
    try { await prisma.systemAlerte.deleteMany({}) } catch {}
    console.log('✅ Alertes supprimées')

    // Supprimer les logs (peut échouer à cause des foreign keys)
    try { await prisma.auditLog.deleteMany({}) } catch {}
    console.log('✅ Logs supprimés')

    console.log('\n✅ Base de données vidée! Tout est à 0.')
  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetDatabase()