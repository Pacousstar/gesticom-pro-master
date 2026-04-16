const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function finalize() {
  const deficit = 36540490
  const realBalance = 5000000
  const totalApport = deficit + realBalance

  // 1. Mettre à jour l'entité Banque
  await p.banque.update({
    where: { id: 1 },
    data: { 
      soldeInitial: totalApport,
      soldeActuel: realBalance 
    }
  })

  // 2. Créer l'écriture comptable d'ajustement
  const journalOD = await p.journal.findUnique({ where: { code: 'OD' } })
  const compte521 = await p.planCompte.findUnique({ where: { numero: '521' } })
  const compte101 = await p.planCompte.findUnique({ where: { numero: '101' } })

  const numeroBase = Date.now()
  await p.ecritureComptable.create({
    data: {
      numero: `FIN-BNQ-${numeroBase}`,
      date: new Date(),
      journalId: journalOD.id,
      piece: 'SOLDE',
      libelle: '[FINALISATION PHASE II] Ajustement du solde réel initial',
      compteId: compte521.id,
      debit: realBalance,
      credit: 0,
      entiteId: 1,
      utilisateurId: 1
    }
  })

  await p.ecritureComptable.create({
    data: {
      numero: `FIN-CAP-${numeroBase}`,
      date: new Date(),
      journalId: journalOD.id,
      piece: 'SOLDE',
      libelle: '[FINALISATION PHASE II] Ajustement du solde réel initial',
      compteId: compte101.id,
      debit: 0,
      credit: realBalance,
      entiteId: 1,
      utilisateurId: 1
    }
  })

  console.log('✅ Synchronisation Trésorerie terminée : 5 000 000 F.')
}

finalize()
  .catch(console.error)
  .finally(() => p.$disconnect())
