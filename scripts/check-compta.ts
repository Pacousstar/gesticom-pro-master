import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts = await Promise.all([
    prisma.planCompte.count(),
    prisma.ecritureComptable.count(),
    prisma.vente.count(),
    prisma.achat.count(),
    prisma.entite.count(),
  ])

  console.log('--- STATISTIQUES DIAGNOSTIC ---')
  console.log('Comptes (PlanCompte):', counts[0])
  console.log('Écritures (EcritureComptable):', counts[1])
  console.log('Ventes:', counts[2])
  console.log('Achats:', counts[3])
  console.log('Entités:', counts[4])

  const comptes = await prisma.planCompte.findMany({ select: { id: true, numero: true, libelle: true } })
  console.log('--- TABLE DES COMPTES ---')
  console.table(comptes)

  if (counts[1] > 0) {
    const sample = await prisma.ecritureComptable.findFirst()
    console.log('Exemple d\'Écriture:', JSON.stringify(sample, null, 2))
    
    const entites = await prisma.ecritureComptable.groupBy({
      by: ['entiteId'],
      _count: { id: true }
    })
    console.log('Répartition par EntiteId:', JSON.stringify(entites, null, 2))
  }

  const activeComptes = await prisma.planCompte.count({ where: { actif: true } })
  console.log('Comptes Actifs:', activeComptes)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
