const ERR_TABLE_NOT_FOUND = 'P2021'
const ERR_DB_NOT_FOUND = 'P1003'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { prisma } = await import('@/lib/db')
    const { repairCaisseIntegrity, repairBankIntegrity } = await import('@/lib/repair')

    let caisses = 0
    try {
      caisses = await repairCaisseIntegrity()
    } catch (err: any) {
      if (err?.code === ERR_TABLE_NOT_FOUND || err?.code === ERR_DB_NOT_FOUND) {
        console.log('[GestiCom] Base non initialisée, réparations ignorées.')
        return
      }
      throw err
    }

    console.log('[GestiCom] Démarrage : réalignement automatique des soldes...')

    const stocks = 0
    const banks = await repairBankIntegrity().catch((err: any) => {
      if (err?.code === ERR_TABLE_NOT_FOUND || err?.code === ERR_DB_NOT_FOUND) return 0
      throw err
    })

    if (caisses + stocks + banks > 0) {
      console.log(`[GestiCom] Réparations appliquées : ${caisses} caisse(s), ${stocks} stock(s), ${banks} banque(s)`)
    } else {
      console.log('[GestiCom] Soldes déjà alignés, aucune réparation nécessaire.')
    }

    const { startCronJobs } = await import('@/lib/cron')
    await startCronJobs().catch((err: unknown) =>
      console.error('[GestiCom] Erreur démarrage planificateur :', err)
    )

    await prisma.$disconnect()
  } catch (e) {
    console.error('[GestiCom] Erreur lors du réalignement automatique :', e)
  }
}