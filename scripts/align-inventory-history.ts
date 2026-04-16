import { PrismaClient } from '@prisma/client'
import { comptabiliserMouvementStock } from '../lib/comptabilisation'

const prisma = new PrismaClient()

async function align() {
  console.log('--- DÉBUT DE L\'ALIGNEMENT LOGISTIQUE (RECONSTRUCTION HISTORIQUE) ---')
  
  // 1. Récupérer toutes les positions de stock physiques
  const stocks = await prisma.stock.findMany({
    include: { produit: true }
  })

  let countTotal = 0
  let countAligned = 0

  for (const s of stocks) {
    countTotal++
    // Calculer la somme actuelle des mouvements
    const aggregate = await prisma.mouvement.aggregate({
      where: {
        produitId: s.produitId,
        magasinId: s.magasinId
      },
      _sum: { quantite: true }
    })

    const currentMvtSum = aggregate._sum.quantite || 0
    const diff = s.quantite - currentMvtSum

    if (Math.abs(diff) > 0.001) {
      countAligned++
      console.log(`[ALIGN] Produit: ${s.produit.designation} | Écart: ${diff} | Cible: ${s.quantite}`)

      // Créer le mouvement de régularisation
      const type = diff > 0 ? 'ENTREE' : 'SORTIE'
      const mvt = await prisma.mouvement.create({
        data: {
          produitId: s.produitId,
          magasinId: s.magasinId,
          entiteId: s.entiteId,
          type: 'REGULARISATION', // Type logique pour le topo
          quantite: diff,
          date: new Date(),
          dateOperation: new Date(),
          observation: 'Alignement automatique Audit GestiCom Pro',
          utilisateurId: 1 // Admin
        }
      })

      // Comptabiliser le mouvement
      await comptabiliserMouvementStock({
        produitId: s.produitId,
        magasinId: s.magasinId,
        type: type as 'ENTREE' | 'SORTIE',
        quantite: Math.abs(diff),
        date: new Date(),
        motif: `Régularisation Alignement Physique (Audit)`,
        utilisateurId: 1,
        entiteId: s.entiteId,
        mouvementId: mvt.id
      })
    }
  }

  console.log(`--- ALIGNEMENT TERMINÉ ---`)
  console.log(`Total positions traitées: ${countTotal}`)
  console.log(`Positions régularisées: ${countAligned}`)
}

align()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
