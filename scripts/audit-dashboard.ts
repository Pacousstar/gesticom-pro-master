import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function toNum(v: any): number {
  return typeof v === 'number' && !isNaN(v) ? v : 0
}

async function main() {
  console.log('=== AUDIT DES COMPTEURS DASHBOARD ===')
  console.log()

  const now = new Date()
  const debAuj = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const finAuj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const debHier = new Date(debAuj.getTime() - 86400000)
  const finHier = new Date(finAuj.getTime() - 86400000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // 1. CA Jour
  const caJourAgg = await prisma.vente.aggregate({
    where: { date: { gte: debAuj, lte: finAuj }, statut: { in: ['VALIDE', 'VALIDEE'] } },
    _sum: { montantTotal: true },
  })
  console.log(`1. CA Jour: ${toNum(caJourAgg._sum.montantTotal).toLocaleString('fr-FR')} F`)

  // 1b. Transactions Jour
  const txJour = await prisma.vente.count({
    where: { date: { gte: debAuj, lte: finAuj }, statut: { in: ['VALIDE', 'VALIDEE'] } },
  })
  console.log(`2. Transactions Jour: ${txJour}`)

  // 2. CA Mois
  const caMoisAgg = await prisma.vente.aggregate({
    where: { date: { gte: startOfMonth }, statut: { in: ['VALIDE', 'VALIDEE'] } },
    _sum: { montantTotal: true },
  })
  console.log(`3. CA Mois: ${toNum(caMoisAgg._sum.montantTotal).toLocaleString('fr-FR')} F`)

  // 3. Panier Moyen (all-time)
  const caTotalAgg = await prisma.vente.aggregate({
    where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
    _sum: { montantTotal: true },
    _count: { id: true },
  })
  const caTotal = toNum(caTotalAgg._sum.montantTotal)
  const nbVentes = caTotalAgg._count.id
  const panier = nbVentes > 0 ? Math.round(caTotal / nbVentes) : 0
  console.log(`4. Panier Moyen: ${panier.toLocaleString('fr-FR')} F (${caTotal.toLocaleString('fr-FR')} F / ${nbVentes} ventes)`)

  // 4. Produits catalogue
  const nbProduits = await prisma.produit.count({ where: { actif: true } })
  console.log(`5. Produits catalogue: ${nbProduits}`)

  // 5. Produits en stock (qty > 0)
  const stocks = await prisma.stock.findMany({ select: { quantite: true } })
  const produitsEnStock = stocks.filter(s => s.quantite > 0).length
  console.log(`6. Produits en stock: ${produitsEnStock}/${stocks.length} (qty>0/total)`)

  // 6. Mouvements Jour
  const mouvsJour = await prisma.mouvement.count({
    where: { date: { gte: debAuj, lte: finAuj } },
  })
  console.log(`7. Mouvements Jour: ${mouvsJour}`)

  // 7. Clients actifs
  const clientsActifs = await prisma.client.count({ where: { actif: true } })
  console.log(`8. Clients actifs: ${clientsActifs}`)

  // 8. Valeur Stock PAMP
  const stocksComplets = await prisma.stock.findMany({
    include: { produit: { select: { pamp: true, prixAchat: true, prixVente: true } } },
  })
  let totalAchat = 0
  let totalVente = 0
  let nbRuptures = 0
  let stocksAvecQte = 0
  for (const s of stocksComplets) {
    const prix = (s.produit.pamp || 0) > 0 ? s.produit.pamp : (s.produit.prixAchat || 0)
    totalAchat += s.quantite * prix
    totalVente += s.quantite * (s.produit.prixVente || 0)
    if (s.quantite > 0) stocksAvecQte++
    if (s.quantite <= 0) nbRuptures++
  }
  console.log(`9. Valeur Stock (Achat): ${totalAchat.toLocaleString('fr-FR')} F`)
  console.log(`10. Valeur Stock (Vente): ${totalVente.toLocaleString('fr-FR')} F`)
  const totalStocks = nbRuptures + stocksAvecQte
  const txRupture = totalStocks > 0 ? Math.round((nbRuptures / totalStocks) * 100) : 0
  console.log(`11. Taux Rupture: ${txRupture}% (${nbRuptures} ruptures / ${totalStocks} stocks)`)

  // 9. Trésorerie
  const caisseEntrees = await prisma.caisse.aggregate({
    where: { type: 'ENTREE' },
    _sum: { montant: true },
  })
  const caisseSorties = await prisma.caisse.aggregate({
    where: { type: 'SORTIE' },
    _sum: { montant: true },
  })
  const soldeCaisse = toNum(caisseEntrees._sum.montant) - toNum(caisseSorties._sum.montant)
  console.log(`12. Trésorerie Caisse: ${soldeCaisse.toLocaleString('fr-FR')} F`)

  const banqueAgg = await prisma.banque.aggregate({ _sum: { soldeActuel: true } })
  const soldeBanque = toNum(banqueAgg._sum.soldeActuel)
  console.log(`13. Trésorerie Banque: ${soldeBanque.toLocaleString('fr-FR')} F`)
  console.log(`14. Trésorerie Globale: ${(soldeCaisse + soldeBanque).toLocaleString('fr-FR')} F`)

  // 10. Créances et Dettes (via soldes endpoints)
  const creancesAgg = await prisma.vente.aggregate({
    where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
    _sum: { montantTotal: true, montantPaye: true },
  })
  const totalCreances = toNum(creancesAgg._sum.montantTotal) - toNum(creancesAgg._sum.montantPaye)
  console.log(`15. Créances Clients (brut): ${totalCreances.toLocaleString('fr-FR')} F`)

  const dettesAgg = await prisma.achat.aggregate({
    where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
    _sum: { montantTotal: true, montantPaye: true, fraisApproche: true },
  })
  const totalDettes = (toNum(dettesAgg._sum.montantTotal) + toNum(dettesAgg._sum.fraisApproche)) - toNum(dettesAgg._sum.montantPaye)
  console.log(`16. Dettes Fournisseurs (brut): ${totalDettes.toLocaleString('fr-FR')} F`)

  // 11. Top 5 produits
  const topProduits = await prisma.venteLigne.groupBy({
    by: ['produitId', 'designation'],
    _sum: { montant: true, quantite: true },
    orderBy: { _sum: { montant: 'desc' } },
    take: 5,
    where: { vente: { statut: { in: ['VALIDE', 'VALIDEE'] } } },
  })
  console.log(`17. Top 5 Produits:`)
  for (const t of topProduits) {
    console.log(`   ${t.designation}: ${toNum(t._sum.montant).toLocaleString('fr-FR')} F (${toNum(t._sum.quantite)} vendus)`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
