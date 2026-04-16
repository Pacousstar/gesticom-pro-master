import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function reconcile() {
  console.log('--- RÉCONCILIATION DE LA TRÉSORERIE (AUDIT 2026) ---')

  const banques = await prisma.banque.findMany()
  
  for (const b of banques) {
    console.log(`\nAnalyse du compte : ${b.nomBanque} (${b.numero})`)
    
    const lastOp = await prisma.operationBancaire.findFirst({
      where: { banqueId: b.id },
      orderBy: { id: 'desc' }
    })
    
    const soldeTheo = lastOp ? lastOp.soldeApres : b.soldeInitial
    
    console.log(`- Solde en Table  : ${b.soldeActuel.toLocaleString()} FCFA`)
    console.log(`- Solde Réel (Dernière Op) : ${soldeTheo.toLocaleString()} FCFA`)
    
    const ecart = soldeTheo - b.soldeActuel
    
    if (Math.abs(ecart) > 0.01) {
      console.log(`⚠️ ÉCART DÉTECTÉ : ${ecart.toLocaleString()} FCFA`)
      
      // Mise à jour de régularisation
      await prisma.banque.update({
        where: { id: b.id },
        data: { soldeActuel: soldeTheo }
      })
      
      console.log(`✅ SOLDE RÉALIGNÉ AVEC SUCCÈS.`)
    } else {
      console.log(`✅ SOLDE DÉJÀ COHÉRENT.`)
    }
  }

  console.log('\n--- FIN DE LA RÉCONCILIATION ---')
}

reconcile()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
