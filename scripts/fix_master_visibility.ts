import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 DÉMARRAGE DE LA RÉPARATION TOTALE DE VISIBILITÉ (MASTER-SHIELD)')
  console.log('--------------------------------------------------------------')

  try {
    // 1. Trouver l'entité et le magasin par défaut
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    const magasin = await prisma.magasin.findFirst({ orderBy: { id: 'asc' } })

    if (!entite || !magasin) {
      throw new Error('Aucune entité ou magasin trouvé. Veuillez configurer votre structure.')
    }

    const eid = entite.id
    const mid = magasin.id

    console.log(`📍 Entité cible : ${entite.nom} (ID: ${eid})`)
    console.log(`📍 Magasin cible : ${magasin.nom} (ID: ${mid})`)

    // 2. RATTRAPAGE MASSIF
    console.log('\n🔧 Réparation des données orphelines...')

    const results = await Promise.all([
      // Stocks (Crucial pour la valeur de stock)
      prisma.stock.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),
      
      // Produits
      prisma.produit.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid } }),

      // Dépenses (Audit compteur vs liste)
      prisma.depense.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),

      // Charges
      prisma.charge.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),

      // Écritures Comptables (Crucial pour le BILAN)
      prisma.ecritureComptable.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid } }),

      // Mouvements de stock
      prisma.mouvement.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),

      // Caisse
      prisma.caisse.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),

      // Ventes et Achats
      prisma.vente.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } }),
      prisma.achat.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
    ])

    console.log('\n✅ RÉPARATION TERMINÉE AVEC SUCCÈS :')
    console.log(`- Stocks : ${results[0].count} lignes`)
    console.log(`- Produits : ${results[1].count} lignes`)
    console.log(`- Dépenses : ${results[2].count} lignes`)
    console.log(`- Charges : ${results[3].count} lignes`)
    console.log(`- Écritures (Bilan) : ${results[4].count} lignes`)
    console.log(`- Mouvements : ${results[5].count} lignes`)
    console.log(`- Caisse : ${results[6].count} lignes`)
    console.log(`- Ventes/Achats : ${results[7].count + results[8].count} lignes`)

    console.log('\n🌟 Vos menus devraient maintenant afficher toutes les données !')

  } catch (e) {
    console.error('❌ ERREUR :', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
