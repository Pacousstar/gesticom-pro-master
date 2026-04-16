const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function reconcilerMouvements() {
  console.log('--- 🔄 RÉCONCILIATION DE LA PISTE D\'AUDIT (STOCK) ---')
  
  const produits = await prisma.produit.findMany({
    include: {
      stocks: true,
      mouvements: true
    }
  })

  let totalMvtCreated = 0
  let totalValeurRecuperee = 0

  for (const p of produits) {
    const qteReelle = p.stocks.reduce((acc, s) => acc + s.quantite, 0)
    const qteMouvements = p.mouvements.reduce((acc, m) => {
      return acc + (m.type === 'ENTREE' ? m.quantite : -m.quantite)
    }, 0)

    const delta = qteReelle - qteMouvements

    if (Math.abs(delta) > 0.0001) {
      // On choisit le premier magasin disponible pour cet ajustement
      const targetMagasinId = p.stocks.length > 0 ? p.stocks[0].magasinId : 1
      
      await prisma.mouvement.create({
        data: {
          date: new Date(),
          type: delta > 0 ? 'ENTREE' : 'SORTIE',
          produitId: p.id,
          magasinId: targetMagasinId,
          entiteId: p.entiteId || 1,
          utilisateurId: 1, // Admin par défaut
          quantite: Math.abs(delta),
          observation: `[RÉCONCILIATION PHASE II] Alignement audit trail sur stock réel`
        }
      })
      
      totalMvtCreated++
      totalValeurRecuperee += Math.abs(delta) * (p.pamp || p.prixAchat || 0)
    }
  }

  console.log(`\nRéconciliation terminée :`)
  console.log(`- ${totalMvtCreated} mouvements de régularisation créés.`)
  console.log(`- Valeur totale réintégrée : ${Math.round(totalValeurRecuperee).toLocaleString()} F`)
}

reconcilerMouvements()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
