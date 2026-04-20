const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function financialAudit() {
  console.log('=== RAPPORT D\'AUDIT FINANCIER GESTICOM PRO ===\n')

  // 1. Audit des Caisses (Magasins)
  console.log('--- 1. Audit des Caisses (Magasins) ---')
  const magasins = await prisma.magasin.findMany({ select: { id: true, nom: true, soldeCaisse: true } })
  for (const m of magasins) {
    const operations = await prisma.caisse.findMany({ where: { magasinId: m.id } })
    const calculatedSolde = operations.reduce((acc, op) => {
      return op.type === 'ENTREE' ? acc + op.montant : acc - op.montant
    }, 0)
    
    const diff = m.soldeCaisse - calculatedSolde
    console.log(`Magasin: ${m.nom}`)
    console.log(`  Solde stocké: ${m.soldeCaisse.toLocaleString()} FCFA`)
    console.log(`  Solde calculé: ${calculatedSolde.toLocaleString()} FCFA`)
    if (Math.abs(diff) > 0.01) {
      console.warn(`  ⚠️ ÉCART DÉTECTÉ: ${diff.toLocaleString()} FCFA`)
    } else {
      console.log(`  ✅ COHÉRENT`)
    }
  }

  // 2. Audit des Banques
  console.log('\n--- 2. Audit des Banques ---')
  const banques = await prisma.banque.findMany({ select: { id: true, libelle: true, soldeActuel: true, soldeInitial: true } })
  for (const b of banques) {
    const operations = await prisma.operationBancaire.findMany({ where: { banqueId: b.id } })
    const calculatedMouvement = operations.reduce((acc, op) => {
      return op.type === 'DEPOT' ? acc + op.montant : acc - op.montant
    }, 0)
    const totalCalculated = b.soldeInitial + calculatedMouvement
    const diff = b.soldeActuel - totalCalculated
    
    console.log(`Banque: ${b.libelle}`)
    console.log(`  Solde stocké: ${b.soldeActuel.toLocaleString()} FCFA`)
    console.log(`  Solde calculé: ${totalCalculated.toLocaleString()} FCFA (Initial: ${b.soldeInitial})`)
    if (Math.abs(diff) > 0.01) {
      console.warn(`  ⚠️ ÉCART DÉTECTÉ: ${diff.toLocaleString()} FCFA`)
    } else {
      console.log(`  ✅ COHÉRENT`)
    }
  }

  // 3. Intégrité Comptable (Écritures manquantes)
  console.log('\n--- 3. Intégrité Comptable (Flux manquants) ---')
  
  const validateVentes = await prisma.vente.count({ where: { statut: 'VALIDEE' } })
  const ecrituresVentes = await prisma.ecritureComptable.count({ where: { referenceType: 'VENTE' } })
  console.log(`Ventes validées: ${validateVentes} | Écritures associées: ${ecrituresVentes}`)
  if (validateVentes > ecrituresVentes / 2) { // 1 vente = au moins 2 écritures (D/C)
     // On ne peut pas conclure juste sur le count car multis-lignes, mais c'est un indicateur.
  }

  const validatedAchats = await prisma.achat.count({ where: { statut: 'VALIDEE' } })
  const ecrituresAchats = await prisma.ecritureComptable.count({ where: { referenceType: 'ACHAT' } })
  console.log(`Achats validés: ${validatedAchats} | Écritures associées: ${ecrituresAchats}`)

  const depensesCount = await prisma.depense.count()
  const ecrituresDepenses = await prisma.ecritureComptable.count({ where: { referenceType: 'DEPENSE' } })
  console.log(`Dépenses totales: ${depensesCount} | Écritures associées: ${ecrituresDepenses}`)

  console.log('\n--- Fin de l\'audit ---')
  await prisma.$disconnect()
}

financialAudit().catch(err => {
  console.error(err)
  process.exit(1)
})
