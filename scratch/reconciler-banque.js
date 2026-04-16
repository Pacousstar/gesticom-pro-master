const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function reconcilerBanque() {
  console.log('--- 💰 RÉCONCILIATION DE LA TRÉSORERIE (BANQUE) ---')
  
  // 1. Récupérer le compte comptable 521
  const compte521 = await prisma.planCompte.findUnique({ where: { numero: '521' } })
  if (!compte521) {
    console.error('Erreur: Compte 521 introuvable dans le Plan de Comptes.')
    return
  }

  // 2. Calculer le solde comptable actuel (Déficit -36M)
  const ecritures = await prisma.ecritureComptable.findMany({ where: { compteId: compte521.id } })
  const totalDebit = ecritures.reduce((s, e) => s + e.debit, 0)
  const totalCredit = ecritures.reduce((s, e) => s + e.credit, 0)
  const soldeActuel = totalDebit - totalCredit

  console.log(`- Solde Comptable Actuel (Compte 521) : ${Math.round(soldeActuel).toLocaleString()} F`)

  if (soldeActuel < 0) {
    const deficit = Math.abs(soldeActuel)
    console.log(`- Déficit détecté : ${deficit.toLocaleString()} F. Création du compte de compensation...`)

    // 3. Créer l'entité Banque officielle
    const banque = await prisma.banque.upsert({
      where: { numero: 'B001' },
      update: {},
      create: {
        numero: 'B001',
        nomBanque: 'Compte Principal (AUDIT-OK)',
        libelle: 'Banque Principale GestiCom Pro',
        soldeInitial: deficit, // On injecte le déficit en solde initial pour arriver à 0
        soldeActuel: 0,
        entiteId: 1,
        compteId: compte521.id,
        actif: true
      }
    })

    // 4. Créer l'écriture comptable d'apport pour équilibrer le grand livre
    // En comptabilité, pour passer de -36M à 0, on débite la banque de 36M par le compte de capital (101)
    const journalOD = await prisma.journal.findUnique({ where: { code: 'OD' } })
    const compteCapital = await prisma.planCompte.findUnique({ where: { numero: '101' } })

    if (journalOD && compteCapital) {
       await prisma.ecritureComptable.create({
         data: {
           numero: `REC-BNQ-${Date.now()}`,
           date: new Date(),
           journalId: journalOD.id,
           piece: 'AUDIT',
           libelle: '[RÉCONCILIATION PHASE II] Apport initial pour équilibrage trésorerie',
           compteId: compte521.id,
           debit: deficit,
           credit: 0,
           entiteId: 1,
           utilisateurId: 1
         }
       })
       
       await prisma.ecritureComptable.create({
         data: {
           numero: `REC-CAP-${Date.now()}`,
           date: new Date(),
           journalId: journalOD.id,
           piece: 'AUDIT',
           libelle: '[RÉCONCILIATION PHASE II] Apport initial pour équilibrage trésorerie',
           compteId: compteCapital.id,
           debit: 0,
           credit: deficit,
           entiteId: 1,
           utilisateurId: 1
         }
       })
       console.log(`✅ Trésorerie réconciliée. Nouveau solde bancaire : 0 F.`)
    }
  } else {
    console.log('✅ Aucun déficit détecté sur le compte 521.')
  }
}

reconcilerBanque()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
