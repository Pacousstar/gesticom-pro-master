import { prisma } from '@/lib/db'

const RETENTION_DAYS = 365

export async function purgeOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  const result = await prisma.auditLog.deleteMany({
    where: {
      date: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

if (require.main === module) {
  purgeOldAuditLogs()
    .then((count) => {
      console.log(`${count} logs d'audit supprimés (plus de ${RETENTION_DAYS} jours)`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Erreur lors de la purge des logs:', error)
      process.exit(1)
    })
}