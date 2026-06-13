export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { prisma } = await import('@/lib/db')
      const { repairCaisseIntegrity, repairBankIntegrity } = await import('@/lib/repair')

      console.log('[GestiCom] Démarrage : réalignement automatique des soldes...')

      const caisses = await repairCaisseIntegrity()
      const stocks = 0 // repairStockIntegrity désactivé : recalcule les stocks via Mouvements, ce qui écrase les stocks initiaux (imports, inventaires)
      const banks = await repairBankIntegrity()

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
}