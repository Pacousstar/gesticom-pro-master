const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanup() {
  console.log('--- Démarrage du nettoyage des doublons ---')
  
  const allEcritures = await prisma.ecritureComptable.findMany({
    select: { id: true, date: true, compteId: true, debit: true, credit: true, libelle: true },
    orderBy: { id: 'asc' }
  })

  const toDelete = []
  const seen = new Map()

  for (const e of allEcritures) {
    const day = e.date.toISOString().split('T')[0]
    const key = `${day}_${e.compteId}_${e.debit}_${e.credit}_${e.libelle}`
    
    if (seen.has(key)) {
      toDelete.push(e.id)
    } else {
      seen.set(key, e.id)
    }
  }

  console.log(`Nombre d'écritures à supprimer : ${toDelete.length}`)
  
  if (toDelete.length > 0) {
    // Suppression par lots pour éviter les soucis de performance
    const deleted = await prisma.ecritureComptable.deleteMany({
      where: { id: { in: toDelete } }
    })
    console.log(`${deleted.count} écritures supprimées avec succès.`)
  } else {
    console.log('Aucun doublon à supprimer.')
  }

  await prisma.$disconnect()
}

cleanup().catch(err => {
  console.error(err)
  process.exit(1)
})
