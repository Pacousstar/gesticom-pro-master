const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function unlockVentes() {
  console.log('🏁 DÉBLOQUAGE DES VENTES CLIENT (FORCE STATUT & ENTITÉ)...')
  
  try {
    // 1. Détecter l'entité de l'administrateur (souvent ID 1)
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    if (!entite) {
      console.error('❌ ÉCHEC : Aucune entité trouvée pour le rattachement.')
      return
    }
    const targetId = entite.id
    console.log(`📍 Rattachement vers l'entité : #${targetId} (${entite.nom})`)

    // 2. Forcer le statut VALIDEE et l'entiteId sur TOUTES les ventes
    // pour garantir qu'elles apparaissent dans les filtres par défaut de l'interface.
    const res = await prisma.vente.updateMany({
      data: { 
        entiteId: targetId,
        statut: 'VALIDEE' 
      }
    })
    
    console.log(`✅ ${res.count} ventes ont été synchronisées et débloquées !`)
    console.log('📊 Vous pouvez maintenant rafraîchir l\'écran des ventes chez le client.')

  } catch (err) {
    console.error('❌ ERREUR LORS DU DÉBLOQUAGE :', err)
  } finally {
    await prisma.$disconnect()
  }
}

unlockVentes()
