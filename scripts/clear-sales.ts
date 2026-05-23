import { prisma } from '../lib/db'

async function clearSalesAndPurchases() {
  console.log('🗑️ Suppression de toutes les ventes et tous les achats...\n')

  try {
    // Supprimer les règlements liés aux ventes (lignes d'abord, puis règlements)
    await prisma.reglementVenteLigne.deleteMany({})
    const regVentes = await prisma.reglementVente.deleteMany({})
    console.log(`✅ Réglements ventes supprimés: ${regVentes.count}`)

    // Supprimer les lignes de ventes
    const lignesVente = await prisma.venteLigne.deleteMany({})
    console.log(`✅ Lignes ventes supprimées: ${lignesVente.count}`)

    // Supprimer les ventes
    const ventes = await prisma.vente.deleteMany({})
    console.log(`✅ Ventes supprimées: ${ventes.count}`)

    // Supprimer les règlements liés aux achats (lignes d'abord, puis règlements)
    await prisma.reglementAchatLigne.deleteMany({})
    const regAchats = await prisma.reglementAchat.deleteMany({})
    console.log(`✅ Réglements achats supprimés: ${regAchats.count}`)

    // Supprimer les lignes d'achats
    const lignesAchat = await prisma.achatLigne.deleteMany({})
    console.log(`✅ Lignes achats supprimées: ${lignesAchat.count}`)

    // Supprimer les achats
    const achats = await prisma.achat.deleteMany({})
    console.log(`✅ Achats supprimés: ${achats.count}`)

    console.log('\n✅ Opération terminée avec succès!')
  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearSalesAndPurchases()