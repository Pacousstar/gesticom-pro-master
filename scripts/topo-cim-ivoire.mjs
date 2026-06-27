import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  const p = await prisma.produit.findFirst({ where: { code: 'ETB-00152' } })
  if (!p) { console.log('Produit introuvable'); process.exit(1) }

  const stock = await prisma.stock.findUnique({
    where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } }
  })

  // Toutes les ventes LIVRAISON_IMMEDIATE
  const ventes = await prisma.venteLigne.findMany({
    where: {
      produitId: p.id,
      vente: { typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false, statut: 'VALIDEE' }
    },
    include: { vente: { select: { numero: true, date: true } } },
    orderBy: { vente: { date: 'asc' } }
  })

  // Achats (entrées)
  const entrees = await prisma.mouvement.aggregate({
    where: { produitId: p.id, magasinId: 1, type: 'ENTREE' },
    _sum: { quantite: true }
  })

  // Mouvements de sortie
  const sorties = await prisma.mouvement.aggregate({
    where: { produitId: p.id, magasinId: 1, type: 'SORTIE' },
    _sum: { quantite: true }
  })

  const totalEntrees = entrees._sum.quantite || 0
  const totalSorties = sorties._sum.quantite || 0
  const totalVendu = ventes.reduce((s, v) => s + v.quantite, 0)

  // Identifier les ventes modifiées
  const numeros = [...new Set(ventes.map(v => v.vente.numero))]
  const mouvs = await prisma.mouvement.findMany({
    where: {
      observation: { in: numeros.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) },
      produitId: p.id
    }
  })
  const mvtParObs = {}
  for (const m of mouvs) mvtParObs[m.observation] = (mvtParObs[m.observation] || 0) + 1

  let surDeduction = 0
  let ventesModifiees = []

  for (const v of ventes) {
    const nbModifs = mvtParObs[`Modif Vente ${v.vente.numero}`] || 0
    const aVente = mvtParObs[`Vente ${v.vente.numero}`] || 0
    if (nbModifs > 0 && aVente === 0) {
      surDeduction += v.quantite * nbModifs
      ventesModifiees.push({
        numero: v.vente.numero,
        qte: v.quantite,
        date: v.vente.date,
        nbModifs
      })
    }
  }

  console.log('=== TOPO: CIMENT ORDINAIRE CIM IVOIRE (ETB-00152) ===')
  console.log('')
  console.log('1. DONNÉES DE BASE')
  console.log(`   Stock initial DB:    ${stock.quantiteInitiale}`)
  console.log(`   Achats (entrées):    +${totalEntrees}`)
  console.log(`   Ventes (sorties):    -${totalSorties}`)
  console.log(`   Total vendu (lignes): ${totalVendu}`)
  console.log(`   Stock actuel DB:      ${stock.quantite}`)
  console.log('')
  console.log('2. VRAI STOCK ATTENDU (init + achats - ventes)')
  const vraiStock = stock.quantiteInitiale + totalEntrees - totalVendu
  console.log(`   ${stock.quantiteInitiale} + ${totalEntrees} - ${totalVendu} = ${vraiStock}`)
  console.log('')
  console.log('3. VENTES MODIFIÉES (PATCH) — cause de la sur-déduction')
  console.log(`   ${ventesModifiees.length} vente(s) concernée(s) :`)
  for (const vm of ventesModifiees) {
    console.log(`   - ${vm.numero} (${vm.date.toISOString().split('T')[0]}) Qte: ${vm.qte} × ${vm.nbModifs} PATCH = ${vm.qte * vm.nbModifs}U sur-déduites`)
  }
  console.log(`   Sur-déduction totale: ${surDeduction}`)
  console.log('')
  console.log('4. CORRECTION PROPOSÉE')
  console.log(`   Stock actuel:          ${stock.quantite}`)
  console.log(`   + remboursement PATCH: +${surDeduction}`)
  console.log(`   = Stock corrigé:       ${stock.quantite + surDeduction}`)
  console.log(`   Vrai stock attendu:    ${vraiStock}`)
  const delta = (stock.quantite + surDeduction) - vraiStock
  console.log(`   Écart résiduel:        ${delta > 0 ? '+' : ''}${delta}`)
  console.log('')
  console.log('5. LECTURE')
  if (delta === 0) {
    console.log('   ✓ La correction remet le stock EXACTEMENT à la valeur attendue.')
  } else if (Math.abs(delta) < 10) {
    console.log(`   ≈ La correction donne ${stock.quantite + surDeduction}, proche du vrai ${vraiStock}.`)
    console.log(`   L'écart de ${delta} vient de causes antérieures (stock initial, mouvements non comptés).`)
  } else {
    console.log(`   ⚠ Écart résiduel significatif (${delta}). Causes possibles :`)
    console.log('      - Stock initial mal positionné')
    console.log('      - Mouvements d\'entrée/sortie non enregistrés')
    console.log('      - Autres opérations (retours, transferts) non comptabilisées')
  }
  console.log('')
  console.log('6. VENTES NON MODIFIÉES (sans erreur)')
  const ventesSaines = ventes.filter(v => !ventesModifiees.some(vm => vm.numero === v.vente.numero))
  console.log(`   ${ventesSaines.length} ventes correctement déduites (jamais modifiées)`)

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
