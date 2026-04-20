import { PrismaClient } from '@prisma/client'
import { comptabiliserReglementVente } from '../lib/comptabilisation'

const prisma = new PrismaClient()

async function repair() {
  console.log('--- DEBUT DE LA REPARATION CHIRURGICALE ---')

  // 1. REGULARISATION DES STOCKS PAR MOUVEMENTS
  console.log('\n[1/3] Analyse et régularisation des stocks...')
  const stocks = await prisma.stock.findMany({
    include: {
      produit: { select: { designation: true } },
      magasin: { select: { nom: true } }
    }
  })

  let stockCount = 0
  for (const item of stocks) {
    const mvts = await prisma.mouvement.findMany({
      where: { produitId: item.produitId, magasinId: item.magasinId }
    })
    const totalMvts = mvts.reduce((sum, m) => {
      return sum + (m.type === 'ENTREE' ? m.quantite : -m.quantite)
    }, item.quantiteInitiale)
    
    const diff = item.quantite - totalMvts
    if (Math.abs(diff) > 0.001) {
      console.log(`  > ${item.produit.designation} (${item.magasin.nom}): Différence de ${diff}. Création d'un mouvement de régularisation...`)
      await prisma.mouvement.create({
        data: {
          type: diff > 0 ? 'ENTREE' : 'SORTIE',
          produitId: item.produitId,
          magasinId: item.magasinId,
          entiteId: item.entiteId,
          utilisateurId: 1, // Admin système
          quantite: Math.abs(diff),
          observation: 'REGULARISATION AUTOMATIQUE SYSTEME (Zero Erreur)',
          dateOperation: new Date(),
        }
      })
      stockCount++
    }
  }
  console.log(`Résultat : ${stockCount} corrections de stock effectuées.`)

  // 2. REGULARISATION DES REGLEMENTS ORPHELINS
  console.log('\n[2/3] Analyse et régularisation des règlements de vente...')
  const ventesOrphelines = await prisma.vente.findMany({
    where: {
      montantPaye: { gt: 0 },
      reglements: { none: {} }
    }
  })

  let venteCount = 0
  for (const v of ventesOrphelines) {
    console.log(`  > Vente ${v.numero}: ${v.montantPaye} F déclarés payés mais sans règlement. Création...`)
    
    await prisma.$transaction(async (tx) => {
      const reg = await tx.reglementVente.create({
        data: {
          venteId: v.id,
          clientId: v.clientId,
          entiteId: v.entiteId,
          montant: v.montantPaye!,
          modePaiement: v.modePaiement || 'ESPECES',
          utilisateurId: v.utilisateurId,
          observation: 'REGULARISATION AUTOMATIQUE PAIEMENT (Zero Erreur)',
          date: v.date,
        }
      })

      // Comptabilisation
      await comptabiliserReglementVente({
        reglementId: reg.id,
        venteId: v.id,
        numeroVente: v.numero,
        date: v.date,
        montant: v.montantPaye!,
        modePaiement: v.modePaiement || 'ESPECES',
        utilisateurId: v.utilisateurId,
        entiteId: v.entiteId,
        magasinId: v.magasinId
      }, tx)
    })
    venteCount++
  }
  console.log(`Résultat : ${venteCount} ventes régularisées.`)

  // 3. MARQUAGE DES VENTES RAPIDES (HISTORIQUE)
  console.log('\n[3/3] Marquage des ventes rapides historiques...')
  // Heuristique : Vente sans clientId ou client "PASSAGE/ANONYME"
  const updatedVentes = await prisma.vente.updateMany({
    where: {
      clientId: null,
      estVenteRapide: false
    },
    data: {
      estVenteRapide: true
    }
  })
  console.log(`Résultat : ${updatedVentes.count} ventes marquées comme "Rapides".`)

  console.log('\n--- REPARATION TERMINEE AVEC SUCCES ---')
  await prisma.$disconnect()
}

repair().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
