import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  // 1. Tous les produits avec stock négatif
  const negatifs = await prisma.stock.findMany({
    where: { quantite: { lt: 0 } },
    include: { produit: { select: { id: true, code: true, designation: true, pamp: true } } },
    orderBy: { quantite: 'asc' },
  })
  console.log('=== PRODUITS AVEC STOCK NÉGATIF ===')
  if (negatifs.length === 0) console.log('Aucun')
  for (const s of negatifs) {
    console.log(s.produit.code, '|', s.produit.designation, '| Stock:', s.quantite, '| Magasin:', s.magasinId)
  }

  // 2. Produits avec écart entre mouvements et stock réel
  console.log('\n=== VÉRIFICATION COHÉRENCE STOCK/MOUVEMENTS ===')
  const stocks = await prisma.stock.findMany({
    where: { quantite: { not: 0 } },
    include: { produit: { select: { id: true, code: true, designation: true } } },
    take: 100,
  })

  let incoherents = 0
  for (const s of stocks) {
    const sumEntrees = await prisma.mouvement.aggregate({
      where: { produitId: s.produitId, magasinId: s.magasinId, type: 'ENTREE' },
      _sum: { quantite: true },
    })
    const sumSorties = await prisma.mouvement.aggregate({
      where: { produitId: s.produitId, magasinId: s.magasinId, type: 'SORTIE' },
      _sum: { quantite: true },
    })
    const entrees = sumEntrees._sum.quantite || 0
    const sorties = sumSorties._sum.quantite || 0
    const attendu = s.quantiteInitiale + entrees - sorties
    const diff = Math.abs(s.quantite - attendu)
    if (diff > 1) {
      incoherents++
      console.log(s.produit.code, '|', s.produit.designation, '| Stock DB:', s.quantite, '| Attendu (Init+Ent-Sor):', attendu, '| Écart:', s.quantite - attendu)
    }
  }
  if (incoherents === 0) console.log('Aucun écart significatif trouvé (tolérance 1 unité)')

  // 3. Ventes LIVRAISON_IMMEDIATE avec quantiteLivree = 0 (incohérentes)
  console.log('\n=== VENTES LIVRAISON_IMMEDIATE AVEC QTE_LIVREE=0 ===')
  const ventes = await prisma.venteLigne.findMany({
    where: { quantiteLivree: 0 },
    include: {
      vente: { select: { numero: true, date: true, typeVente: true, retraitDiffere: true, statut: true } },
      produit: { select: { code: true, designation: true } },
    },
    orderBy: { vente: { date: 'desc' } },
  })
  const suspectes = ventes.filter(l => l.vente.typeVente === 'LIVRAISON_IMMEDIATE' && !l.vente.retraitDiffere && l.vente.statut === 'VALIDEE')
  if (suspectes.length === 0) console.log('Aucune')
  for (const l of suspectes) {
    console.log(l.vente.numero, '|', l.produit.code, l.produit.designation, '| Qte:', l.quantite, '| Livree: 0 | Date:', l.vente.date.toISOString().split('T')[0])
  }

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
