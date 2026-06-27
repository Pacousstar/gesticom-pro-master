import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  // Récupérer toutes les ventes LIVRAISON_IMMEDIATE en une seule requête
  const ventes = await prisma.vente.findMany({
    where: {
      typeVente: 'LIVRAISON_IMMEDIATE',
      retraitDiffere: false,
      statut: 'VALIDEE',
    },
    include: { lignes: true },
    orderBy: { date: 'desc' },
  })
  console.log(`Total LIVRAISON_IMMEDIATE VALIDEES: ${ventes.length}`)

  // Récupérer TOUS les mouvements en une seule requête
  const numeros = ventes.map(v => v.numero)
  const mouvements = await prisma.mouvement.findMany({
    where: { observation: { in: numeros.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) } }
  })

  // Indexer les mouvements par observation
  const mvtParObs = {}
  for (const m of mouvements) {
    const key = m.observation
    mvtParObs[key] = (mvtParObs[key] || 0) + 1
  }

  let avecCreation = 0
  let sansCreation = 0
  let sansCreationAvecModif = 0
  let sansAucunMouvement = []

  for (const v of ventes) {
    const aVente = mvtParObs[`Vente ${v.numero}`] || 0
    const aModif = mvtParObs[`Modif Vente ${v.numero}`] || 0

    if (aVente > 0) avecCreation++
    else {
      sansCreation++
      if (aModif > 0) sansCreationAvecModif++
      else sansAucunMouvement.push(v)
    }
  }

  console.log(`\n=== RÉSULTATS ===`)
  console.log(`Avec mouvement "Vente" (création): ${avecCreation}`)
  console.log(`SANS mouvement "Vente" (création): ${sansCreation}`)
  console.log(`  → dont avec "Modif Vente": ${sansCreationAvecModif}`)
  console.log(`  → sans aucun mouvement: ${sansAucunMouvement.length}`)

  // Analyser les ventes sans aucun mouvement (sous-déduction)
  if (sansAucunMouvement.length > 0) {
    console.log(`\n=== VENTES SANS AUCUN MOUVEMENT (stock jamais déduit) ===`)
    const detailsParProduit = {}
    for (const v of sansAucunMouvement) {
      for (const l of v.lignes) {
        if (!detailsParProduit[l.produitId]) detailsParProduit[l.produitId] = { qte: 0, code: '' }
        detailsParProduit[l.produitId].qte += l.quantite
      }
    }
    // Récupérer les codes produits en batch
    const pIds = Object.keys(detailsParProduit).map(Number)
    const produits = await prisma.produit.findMany({ where: { id: { in: pIds } }, select: { id: true, code: true } })
    for (const p of produits) {
      if (detailsParProduit[p.id]) detailsParProduit[p.id].code = p.code
    }
    for (const [pid, d] of Object.entries(detailsParProduit)) {
      console.log(`  Produit ${pid} (${d.code}): ${d.qte} unités non déduites`)
    }
    const totalNonDeduit = Object.values(detailsParProduit).reduce((s, d) => s + d.qte, 0)
    console.log(`\nTotal unités non déduites: ${totalNonDeduit}`)
  }

  // Ventiler les ventes Modifiées par nombre de modifications
  console.log(`\n=== VENTES AVEC "Modif Vente" (double déduction possible) ===`)
  const statsModifs = {}
  for (const v of ventes) {
    const nbModifs = mvtParObs[`Modif Vente ${v.numero}`] || 0
    if (nbModifs > 0) {
      const qte = v.lignes.reduce((s, l) => s + l.quantite, 0)
      const key = String(nbModifs)
      if (!statsModifs[key]) statsModifs[key] = { nbVentes: 0, qteTotale: 0 }
      statsModifs[key].nbVentes++
      statsModifs[key].qteTotale += qte
    }
  }
  for (const nb of Object.keys(statsModifs).sort((a, b) => Number(a) - Number(b))) {
    const s = statsModifs[nb]
    console.log(`  ${nb} modif(s): ${s.nbVentes} ventes, ${s.qteTotale} unités totales`)
  }

  console.log(`\n=== PRODUITS IMPACTÉS PAR DOUBLE DÉDUCTION ===`)
  // Récupérer tous les produits en batch
  const lignesImpactees = []
  for (const v of ventes) {
    const nbModifs = mvtParObs[`Modif Vente ${v.numero}`] || 0
    const aVente = mvtParObs[`Vente ${v.numero}`] || 0
    if (nbModifs > 0 && aVente === 0) {
      for (const l of v.lignes) {
        lignesImpactees.push({ produitId: l.produitId, nbModifs, quantite: l.quantite })
      }
    }
  }

  // Aggréger par produit
  const prodSurDeduction = {}
  const prodIdsImpactes = new Set()
  for (const li of lignesImpactees) {
    if (!prodSurDeduction[li.produitId]) prodSurDeduction[li.produitId] = 0
    prodSurDeduction[li.produitId] += li.quantite * li.nbModifs
    prodIdsImpactes.add(li.produitId)
  }

  // Récupérer les noms des produits
  const produitsImpactes = await prisma.produit.findMany({
    where: { id: { in: Array.from(prodIdsImpactes) } },
    select: { id: true, code: true, designation: true }
  })
  const prodMap = {}
  for (const p of produitsImpactes) prodMap[p.id] = p

  for (const pid of Object.keys(prodSurDeduction).sort((a, b) => prodSurDeduction[b] - prodSurDeduction[a])) {
    const p = prodMap[pid]
    if (p) console.log(`  ${p.code} ${p.designation}: sur-déduit de ${prodSurDeduction[pid]} unités`)
    else console.log(`  Produit ${pid}: sur-déduit de ${prodSurDeduction[pid]} unités`)
  }

  console.log(`\nTotal sur-déduction cumulée: ${Object.values(prodSurDeduction).reduce((s, v) => s + v, 0)} unités`)

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
