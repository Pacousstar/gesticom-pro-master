import cron from 'node-cron'
import { prisma } from './db'
import { createBackup } from './sauvegarde-db'
import { purgeOldAuditLogs } from './purge-audit-logs'

type ScheduledTask = ReturnType<typeof cron.schedule>
let tasks: ScheduledTask[] = []

export async function startCronJobs() {
  stopCronJobs()
  console.log('[cron] Démarrage du planificateur...')
  await planifierSauvegarde()
  planifierPurge()
  planifierArchivage()
  console.log(`[cron] ${tasks.length} tâche(s) planifiée(s)`)
}

export function stopCronJobs() {
  tasks.forEach(t => t.stop())
  tasks = []
  console.log('[cron] Toutes les tâches arrêtées')
}

async function planifierSauvegarde() {
  try {
    const params = await prisma.parametre.findFirst()
    if (!params?.backupAuto) {
      console.log('[cron] Sauvegarde auto désactivée dans les paramètres')
      return
    }

    let expression = ''
    let libelle = ''
    switch (params.backupFrequence) {
      case 'QUOTIDIEN':
        expression = '0 2 * * *'
        libelle = 'quotidienne à 2h'
        break
      case 'HEBDOMADAIRE':
        expression = '0 2 * * 0'
        libelle = 'hebdomadaire (dimanche 2h)'
        break
      case 'MENSUEL':
        expression = '0 2 1 * *'
        libelle = 'mensuelle (1er du mois 2h)'
        break
      default:
        console.log('[cron] Fréquence inconnue:', params.backupFrequence)
        return
    }

    const task = cron.schedule(expression, async () => {
      console.log('[cron] Exécution sauvegarde automatique...')
      try {
        const resultat = await createBackup()
        console.log('[cron] ✓ Sauvegarde réussie:', resultat)
      } catch (err) {
        console.error('[cron] ✗ Erreur sauvegarde:', err)
      }
    })

    tasks.push(task)
    console.log(`[cron] Sauvegarde planifiée: ${libelle}`)
  } catch (err) {
    console.error('[cron] Erreur planification sauvegarde:', err)
  }
}

function planifierPurge() {
  const task = cron.schedule('0 3 * * *', async () => {
    console.log('[cron] Exécution purge des logs...')
    try {
      const resultat = await purgeOldAuditLogs()
      console.log('[cron] ✓ Purge effectuée')
    } catch (err) {
      console.error('[cron] ✗ Erreur purge:', err)
    }
  })
  tasks.push(task)
  console.log('[cron] Purge des logs planifiée: quotidienne à 3h')
}

function planifierArchivage() {
  const task = cron.schedule('0 4 1 * *', async () => {
    console.log('[cron] Exécution archivage mensuel...')
    try {
      const resultat = await archiverAnciennesVentes()
      console.log(`[cron] ✓ Archivage: ${resultat} vente(s) archivée(s)`)
    } catch (err) {
      console.error('[cron] ✗ Erreur archivage:', err)
    }
  })
  tasks.push(task)
  console.log('[cron] Archivage planifié: mensuel (1er du mois 4h)')
}

async function archiverAnciennesVentes(): Promise<number> {
  const dateLimite = new Date()
  dateLimite.setFullYear(dateLimite.getFullYear() - 1)

  const vieillesVentes = await prisma.vente.findMany({
    where: {
      date: { lt: dateLimite },
      estHistorique: false,
    },
    include: { lignes: true },
  })

  let compte = 0
  for (const vente of vieillesVentes) {
    await prisma.archiveVente.create({
      data: {
        numeroFactureOrigine: vente.numero,
        date: vente.date,
        magasinId: vente.magasinId,
        entiteId: vente.entiteId,
        utilisateurId: vente.utilisateurId,
        clientId: vente.clientId,
        clientLibre: vente.clientLibre,
        montantTotal: vente.montantTotal,
        observation: vente.observation,
        lignes: {
          create: vente.lignes.map(l => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            montant: l.montant,
          })),
        },
      },
    })

    await prisma.vente.update({
      where: { id: vente.id },
      data: { estHistorique: true },
    })
    compte++
  }

  return compte
}
