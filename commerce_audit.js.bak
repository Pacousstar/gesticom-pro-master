const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function commerceAudit() {
  console.log('=== RAPPORT D\'AUDIT COMMERCIAL GESTICOM PRO ===\n')

  // 1. Audit des Ventes -> Stocks
  console.log('--- 1. Audit Ventes vs Sorties de Stocks ---')
  const ventesValidees = await prisma.vente.findMany({
    where: { statut: { in: ['VALIDEE', 'VALIDE'] } },
    select: { id: true, numero: true, montantPaye: true }
  })

  let ventesSansMouvement = 0
  for (const v of ventesValidees) {
    const countMvmts = await prisma.mouvement.count({
      where: { observation: { contains: v.numero } }
    })
    
    if (countMvmts === 0) {
      ventesSansMouvement++
      if (ventesSansMouvement <= 5) {
        console.warn(`  ⚠️ Vente ${v.numero} validée mais SANS mouvement de stock détecté.`)
      }
    }
  }
  console.log(`Ventes validées analysées : ${ventesValidees.length}`)
  console.log(`Ventes avec anomalies de stock : ${ventesSansMouvement}`)

  // 2. Audit des Ventes -> Caisse
  console.log('\n--- 2. Audit Ventes vs Encaissements ---')
  let ventesSansCaisse = 0
  for (const v of ventesValidees) {
    // Note: Dans ce schéma, on vérifie si montantPaye > 0 si montantRecu n'est pas le champ exact
    // On va utiliser v.montantPaye si disponible
    const opCaisse = await prisma.caisse.findFirst({
      where: { motif: { contains: v.numero } }
    })
    if (!opCaisse) {
      ventesSansCaisse++
      if (ventesSansCaisse <= 5) {
        console.warn(`  ⚠️ Vente ${v.numero} validée mais SANS trace en caisse détectée.`)
      }
    }
  }
  console.log(`Ventes sans trace en caisse : ${ventesSansCaisse}`)

  // 3. Audit des Achats
  console.log('\n--- 3. Audit des Achats ---')
  const totalAchats = await prisma.achat.count()
  const achatsBrouillons = await prisma.achat.count({ where: { statut: 'BROUILLON' } })
  const achatsValidees = await prisma.achat.count({ where: { statut: { in: ['VALIDEE', 'VALIDE'] } } })
  
  console.log(`Total Achats en base : ${totalAchats}`)
  console.log(`Achats en BROUILLON : ${achatsBrouillons}`)
  console.log(`Achats VALIDEES : ${achatsValidees}`)

  console.log('\n--- Fin de l\'audit commercial ---')
  await prisma.$disconnect()
}

commerceAudit().catch(err => {
  console.error(err)
  process.exit(1)
})
