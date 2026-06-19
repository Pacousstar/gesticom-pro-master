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
  planifierDetectionSeuils()
  planifierRelances()
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

function planifierDetectionSeuils() {
  const task = cron.schedule('0 5 * * *', async () => {
    console.log('[cron] Détection des stocks sous seuil...')
    try {
      const entites = await prisma.entite.findMany({ select: { id: true } })
      for (const entite of entites) {
        const produits = await prisma.produit.findMany({
          where: { entiteId: entite.id, actif: true },
          include: { stocks: true },
        })

        let alertesCrees = 0
        for (const p of produits) {
          const stockTotal = p.stocks.reduce((s, st) => s + st.quantite, 0)
          if (stockTotal <= p.seuilMin) {
            const alerteExistante = await prisma.systemAlerte.findFirst({
              where: {
                type: 'STOCK_FAIBLE',
                referenceId: p.id,
                lu: false,
                entiteId: entite.id,
                date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            })
            if (!alerteExistante) {
              await prisma.systemAlerte.create({
                data: {
                  type: 'STOCK_FAIBLE',
                  categorie: 'STOCK',
                  message: `${p.designation} (${p.code}) — Stock: ${stockTotal} / Seuil: ${p.seuilMin}`,
                  referenceId: p.id,
                  entiteId: entite.id,
                },
              })
              alertesCrees++
            }
          }
        }
        console.log(`[cron] Entité ${entite.id}: ${alertesCrees} alerte(s) créée(s)`)
      }
    } catch (err) {
      console.error('[cron] ✗ Erreur détection seuils:', err)
    }
  })
  tasks.push(task)
  console.log('[cron] Détection des seuils planifiée: quotidienne à 5h')
}

function planifierRelances() {
  const task = cron.schedule('0 6 * * 1', async () => {
    console.log('[cron] Détection des clients à relancer...')
    try {
      const entites = await prisma.entite.findMany({ select: { id: true } })
      for (const entite of entites) {
        const clients = await prisma.client.findMany({
          where: { entiteId: entite.id, actif: true },
          include: {
            ventes: {
              where: { statut: 'VALIDEE' },
              select: { montantTotal: true, montantPaye: true, date: true },
            },
            reglements: {
              where: { venteId: null, statut: 'VALIDE' },
              select: { montant: true },
            },
          },
        })

        let relancesCrees = 0
        const maintenant = Date.now()

        for (const client of clients) {
          const detteFactures = client.ventes.reduce((s, v) => s + (v.montantTotal - (v.montantPaye || 0)), 0)
          const regsLibres = client.reglements.reduce((s, r) => s + r.montant, 0)
          const solde = detteFactures + (client.soldeInitial || 0) - regsLibres - (client.avoirInitial || 0)

          if (solde <= 0) continue

          const derniereVente = client.ventes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
          const ageJours = derniereVente
            ? Math.floor((maintenant - new Date(derniereVente.date).getTime()) / (24 * 60 * 60 * 1000))
            : 0

          if (ageJours < 30) continue

          const derniereRelance = await prisma.relanceClient.findFirst({
            where: { clientId: client.id },
            orderBy: { date: 'desc' },
          })

          if (derniereRelance) {
            const joursDepuis = Math.floor((maintenant - new Date(derniereRelance.date).getTime()) / (24 * 60 * 60 * 1000))
            if (joursDepuis < 7) continue
          }

          await prisma.relanceClient.create({
            data: {
              clientId: client.id,
              montantDu: solde,
              canal: 'AUTO',
              statut: 'EN_ATTENTE',
              message: `Relance automatique - Solde: ${solde.toLocaleString()} FCFA (${ageJours} jours)`,
            },
          })
          relancesCrees++
        }
        console.log(`[cron] Entité ${entite.id}: ${relancesCrees} relance(s) créée(s)`)
      }
    } catch (err) {
      console.error('[cron] ✗ Erreur détection relances:', err)
    }
  })
  tasks.push(task)
  console.log('[cron] Détection des relances planifiée: hebdomadaire (lundi 6h)')
}
