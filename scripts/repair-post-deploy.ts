/**
 * Script de réparation Post-Déploiement
 * Réaligne soldeCaisse, stocks et soldes bancaires après les corrections C1-C8.
 * 
 * Usage: npx tsx scripts/repair-post-deploy.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function repairCaisseIntegrity() {
  const magasins = await prisma.magasin.findMany()
  let repaired = 0

  for (const m of magasins) {
    const entrees = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'ENTREE' },
      _sum: { montant: true },
    }))._sum.montant || 0

    const sorties = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'SORTIE' },
      _sum: { montant: true },
    }))._sum.montant || 0

    const soldeReel = entrees - sorties

    if (Math.abs((m.soldeCaisse || 0) - soldeReel) > 0.01) {
      console.log(`  Caisse Magasin "${m.nom}" (ID:${m.id}): ${m.soldeCaisse} -> ${soldeReel}`)
      await prisma.magasin.update({
        where: { id: m.id },
        data: { soldeCaisse: soldeReel },
      })
      repaired++
    }
  }
  return repaired
}

async function repairStockIntegrity() {
  const stocks = await prisma.stock.findMany()
  let repaired = 0

  for (const st of stocks) {
    const entrees = await prisma.mouvement.aggregate({
      where: { produitId: st.produitId, magasinId: st.magasinId, type: 'ENTREE' },
      _sum: { quantite: true },
    })
    const sorties = await prisma.mouvement.aggregate({
      where: { produitId: st.produitId, magasinId: st.magasinId, type: 'SORTIE' },
      _sum: { quantite: true },
    })

    const calculReel = (entrees._sum.quantite || 0) - (sorties._sum.quantite || 0)

    if (Math.abs(st.quantite - calculReel) > 0.001) {
      console.log(`  Stock Produit:${st.produitId} Magasin:${st.magasinId}: ${st.quantite} -> ${calculReel}`)
      await prisma.stock.update({
        where: { id: st.id },
        data: { quantite: calculReel },
      })
      repaired++
    }
  }
  return repaired
}

async function repairBankIntegrity() {
  const banques = await prisma.banque.findMany()
  let repaired = 0

  for (const b of banques) {
    const lastOp = await prisma.operationBancaire.findFirst({
      where: { banqueId: b.id },
      orderBy: { id: 'desc' },
    })
    const soldeReel = lastOp ? lastOp.soldeApres : b.soldeInitial

    if (Math.abs(b.soldeActuel - soldeReel) > 0.01) {
      console.log(`  Banque "${b.nom}" (ID:${b.id}): ${b.soldeActuel} -> ${soldeReel}`)
      await prisma.banque.update({
        where: { id: b.id },
        data: { soldeActuel: soldeReel },
      })
      repaired++
    }
  }
  return repaired
}

async function main() {
  console.log('=== Relecture Post-Deploiement GestiCom Pro ===')
  console.log()

  console.log('1. Recalcul des soldes caisse...')
  const caisses = await repairCaisseIntegrity()
  console.log(`   ${caisses} magasin(s) recalcule(s)`)

  console.log('2. Recalcul des quantites stock...')
  const stocks = await repairStockIntegrity()
  console.log(`   ${stocks} stock(s) recalcule(s)`)

  console.log('3. Recalcul des soldes bancaires...')
  const banks = await repairBankIntegrity()
  console.log(`   ${banks} banque(s) recalculee(s)`)

  console.log()
  console.log('=== Termine ===')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})