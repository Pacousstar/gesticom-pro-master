import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function auditStock() {
  console.log('--- AUDIT COHÉRENCE MOUVEMENTS VS STOCK ---')
  
  const stocks = await prisma.stock.findMany({
    include: {
      produit: true
    }
  })

  let errors = 0
  for (const s of stocks) {
    const totalMvts = await prisma.mouvement.aggregate({
      where: { 
        produitId: s.produitId,
        magasinId: s.magasinId,
      },
      _sum: { quantite: true }
    })

    const calcul = totalMvts._sum.quantite || 0
    if (Math.abs(s.quantite - calcul) > 0.01) {
      errors++
      if (errors < 10) {
        console.log(`Produit: ${s.produit.designation} | Stock Table: ${s.quantite} | Mvts Sum: ${calcul} | Écart: ${s.quantite - calcul}`)
      }
    }
  }

  console.log(`Total anomalies de stock détectées: ${errors}`)
}

auditStock()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
