const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function repair() {
  console.log('🚀 DÉMARRAGE DE LA RÉPARATION DES DONNÉES CLIENT...')
  
  try {
    // 1. On récupère l'ID de l'entité principale (souvent 1)
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    if (!entite) {
      console.error('❌ AUCUNE ENTITÉ TROUVÉE EN BASE !')
      return
    }
    const targetId = entite.id
    console.log(`📍 Entité cible détectée : ID #${targetId} (${entite.nom})`)

    // 2. Mise à jour massive de toutes les tables orphelines
    console.log('⏳ Synchronisation des Ventes...')
    await prisma.vente.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Achats...')
    await prisma.achat.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Produits...')
    await prisma.produit.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Stocks...')
    await prisma.stock.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Mouvements...')
    await prisma.mouvement.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Écritures Comptables...')
    await prisma.ecritureComptable.updateMany({ data: { entiteId: targetId } })
    
    console.log('⏳ Synchronisation des Caisse/Dépenses/Charges...')
    await prisma.caisse.updateMany({ data: { entiteId: targetId } })
    await prisma.depense.updateMany({ data: { entiteId: targetId } })
    await prisma.charge.updateMany({ data: { entiteId: targetId } })

    console.log('✅ RÉPARATION TERMINÉE ! Redémarrez le logiciel chez le client.')
  } catch (err) {
    console.error('❌ ERREUR PENDANT LA RÉPARATION :', err)
  } finally {
    await prisma.$disconnect()
  }
}

repair()
