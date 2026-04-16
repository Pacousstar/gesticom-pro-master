import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncStock() {
  console.log('--- DÉBUT DE LA SYNCHRONISATION LOGISTIQUE ---')
  
  // 1. Récupérer tous les couples (Produit, Magasin) ayant des mouvements
  const targets = await prisma.mouvement.groupBy({
    by: ['produitId', 'magasinId']
  })

  console.log(`Traitement de ${targets.length} positions de stock...`)

  for (const t of targets) {
    // Calculer la somme réelle des mouvements
    const aggregate = await prisma.mouvement.aggregate({
      where: {
        produitId: t.produitId,
        magasinId: t.magasinId
      },
      _sum: { quantite: true }
    })

    const realQty = aggregate._sum.quantite || 0

    // Mettre à jour la table Stock
    await prisma.stock.upsert({
      where: {
        produitId_magasinId: {
          produitId: t.produitId,
          magasinId: t.magasinId
        }
      },
      update: { quantite: realQty },
      create: {
        produitId: t.produitId,
        magasinId: t.magasinId,
        quantite: realQty,
        entiteId: 1 // Entité par défaut
      }
    })
  }

  console.log('--- SYNCHRONISATION LOGISTIQUE TERMINÉE ---')
}

syncStock()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
