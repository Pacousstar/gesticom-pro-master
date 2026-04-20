const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function audit() {
  console.log('--- Démarrage de l\'audit des écritures comptables ---')
  
  const allEcritures = await prisma.ecritureComptable.findMany({
    select: {
      id: true,
      date: true,
      compteId: true,
      debit: true,
      credit: true,
      libelle: true,
      piece: true,
      referenceId: true,
      referenceType: true
    }
  })

  console.log(`Total d'écritures analysées : ${allEcritures.length}`)

  const duplicates = []
  const seen = new Map()

  for (const e of allEcritures) {
    // Clé unique plus permissive : même jour, même compte, même montant, même libellé
    const day = e.date.toISOString().split('T')[0]
    const key = `${day}_${e.compteId}_${e.debit}_${e.credit}_${e.libelle}`
    
    if (seen.has(key)) {
      duplicates.push({
        originalId: seen.get(key),
        duplicateId: e.id,
        details: e
      })
    } else {
      seen.set(key, e.id)
    }
  }

  console.log(`Nombre de doublons potentiels identifiés : ${duplicates.length}`)
  
  if (duplicates.length > 0) {
    console.log('\nExemples de doublons :')
    duplicates.slice(0, 5).forEach(d => {
      console.log(`- Original ID: ${d.originalId}, Doublon ID: ${d.duplicateId} | Libellé: ${d.details.libelle} | Montant: ${d.details.debit || d.details.credit}`)
    })
  }

  await prisma.$disconnect()
}

audit().catch(err => {
  console.error(err)
  process.exit(1)
})
