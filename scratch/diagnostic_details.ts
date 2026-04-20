import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnostic() {
  console.log('--- DETAILED VENTE AUDIT (First 5 errors) ---')

  const ventes = await prisma.vente.findMany({
    include: { reglements: true }
  })
  
  let count = 0
  for (const v of ventes) {
    const totalReglements = v.reglements.reduce((sum, r) => sum + r.montant, 0)
    if (Math.abs(v.montantPaye - totalReglements) > 1) {
      console.error(`Vente ${v.numero}:`)
      console.error(`  - montantPaye (field): ${v.montantPaye}`)
      console.error(`  - Total via Reglements: ${totalReglements}`)
      console.error(`  - Diff: ${v.montantPaye - totalReglements}`)
      count++
      if (count >= 5) break
    }
  }

  console.log('\n--- DETAILED STOCK AUDIT (First 5 errors) ---')
  const items = await prisma.stock.findMany({
    take: 500, // Look at many to find errors
    include: {
      produit: { select: { designation: true } },
      magasin: { select: { nom: true } }
    }
  })
  
  count = 0
  for (const item of items) {
    const mvts = await prisma.mouvement.findMany({
      where: { produitId: item.produitId, magasinId: item.magasinId }
    })
    const totalMvts = mvts.reduce((sum, m) => {
      return sum + (m.type === 'ENTREE' ? m.quantite : -m.quantite)
    }, item.quantiteInitiale)
    
    if (Math.abs(item.quantite - totalMvts) > 0.01) {
      console.error(`Stock ${item.produit.designation} (${item.magasin.nom}):`)
      console.error(`  - Stock (field): ${item.quantite}`)
      console.error(`  - Computed (init + mvts): ${totalMvts}`)
      console.error(`  - Diff: ${item.quantite - totalMvts}`)
      count++
      if (count >= 5) break
    }
  }

  await prisma.$disconnect()
}

diagnostic().catch(e => {
  console.error(e)
  process.exit(1)
})
