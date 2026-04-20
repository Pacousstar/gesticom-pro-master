const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function finalizeCleanup() {
  console.log('--- PURGE DES ÉCRITURES ACHATS FANTÔMES ---')
  
  // 1. Récupérer tous les achats validés pour garder leurs écritures
  const validAchats = await prisma.achat.findMany({
    where: { statut: 'VALIDEE' },
    select: { id: true, numero: true }
  })
  const validIds = validAchats.map(a => a.id)
  
  // 2. Supprimer les écritures ACHAT qui ne sont pas liées à ces IDs
  // Note: certaines écritures manuelles peuvent ne pas avoir de referenceId, 
  // mais ici on cible spécifiquement celles générées avec referenceType 'ACHAT'
  const deletedEcritures = await prisma.ecritureComptable.deleteMany({
    where: {
      referenceType: 'ACHAT',
      NOT: {
        referenceId: { in: validIds }
      }
    }
  })
  console.log(`${deletedEcritures.count} écritures d'achats fantômes supprimées.`)

  console.log('\n--- RECALCUL DU SOLDE DE CAISSE (MAGASIN 1) ---')
  const operations = await prisma.caisse.findMany({ where: { magasinId: 1 } })
  const calculatedSolde = operations.reduce((acc, op) => {
    return op.type === 'ENTREE' ? acc + op.montant : acc - op.montant
  }, 0)

  await prisma.magasin.update({
    where: { id: 1 },
    data: { soldeCaisse: calculatedSolde }
  })
  console.log(`Solde de caisse recalculé et mis à jour : ${calculatedSolde.toLocaleString()} FCFA`)

  if (calculatedSolde < 0) {
    console.log('\n--- RÉGULARISATION FINALE À 0 FCFA ---')
    const montantRegul = Math.abs(calculatedSolde)
    
    // Créer l'opération de caisse de régularisation
    await prisma.caisse.create({
      data: {
        magasinId: 1,
        type: 'ENTREE',
        motif: 'RÉGULARISATION SOLDE INITIAL (Audit)',
        montant: montantRegul,
        utilisateurId: 1, // Admin
        entiteId: 1,
        date: new Date(),
        dateOperation: new Date()
      }
    })

    // Mettre à jour le solde final à 0
    await prisma.magasin.update({
      where: { id: 1 },
      data: { soldeCaisse: 0 }
    })
    console.log(`Caisse régularisée à 0 FCFA (+${montantRegul.toLocaleString()} FCFA ajoutés).`)
  }

  await prisma.$disconnect()
}

finalizeCleanup().catch(err => {
  console.error(err)
  process.exit(1)
})
