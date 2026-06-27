import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  // ====== EXEMPLE 1: VERN-218 ======
  const p1 = await prisma.produit.findFirst({ where: { code: 'VERN-218' } })
  const s1 = await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p1.id, magasinId: 1, entiteId: 1 } } })

  const ventes1 = await prisma.venteLigne.findMany({
    where: { produitId: p1.id, vente: { typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false, statut: 'VALIDEE' } },
    include: { vente: { select: { numero: true, date: true } } },
    orderBy: { vente: { date: 'asc' } }
  })

  console.log('=== EXEMPLE 1: VERN-218 (VERNIS A EAU 1L) ===')
  console.log('')
  console.log('ÉTAT ACTUEL:')
  console.log(`  Stock initial en DB: ${s1.quantiteInitiale}`)
  console.log(`  Stock actuel DB:     ${s1.quantite} (NÉGATIF: -6)`)
  console.log('')

  console.log('HISTORIQUE COMPLET DES VENTES:')
  let cumul = s1.quantiteInitiale
  for (const v of ventes1) {
    cumul -= v.quantite
    const date = v.vente.date.toISOString().split('T')[0]
    const marker = cumul < 0 ? ' ← NÉGATIF' : ''
    console.log(`  ${date}  ${v.vente.numero}  Qte: ${v.quantite}  → Stock cumulé: ${cumul}${marker}`)
  }
  console.log(`  -------------------------------------------------`)
  console.log(`  VRAI stock attendu (init - total vendu): ${s1.quantiteInitiale + 48 - 46} = 0 + 48 - 46`)
  console.log('')

  console.log('CE QU\'IL S\'EST PASSÉ:')
  console.log('  Le produit a été acheté 48 unités (ENTREE +48).')
  console.log('  6 ventes totalisent 46 unités vendues.')
  console.log('  Le vrai stock devrait être: 0 + 48 - 46 = 2')
  console.log('')
  console.log('  Mais 2 ventes ont été MODIFIÉES (PATCH) après création:')
  console.log('  - V1780400413371 (Qte 4) le 02/06: déduite à la création, re-déduite par PATCH')
  console.log('  - V1782379150657 (Qte 8) le 25/06: déduite à la création, re-déduite par PATCH')
  console.log('')
  console.log('  BUG: Chaque PATCH re-déduit la quantité sans rembourser la précédente.')
  console.log('  Sur-déduction: V1780400413371 = +4, V1782379150657 = +8')
  console.log('')
  console.log('CORRECTION NÉCESSAIRE:')
  console.log(`  Stock actuel: ${s1.quantite}`)
  console.log('  + Remboursement V1780400413371: +4')
  console.log('  + Remboursement V1782379150657: +8')
  console.log(`  = Stock corrigé: ${s1.quantite + 4 + 8} (attendu: 2)`)

  // ====== EXEMPLE 2: ETB-00016 ======
  const p2 = await prisma.produit.findFirst({ where: { code: 'ETB-00016' } })
  const s2 = await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p2.id, magasinId: 1, entiteId: 1 } } })

  const ventes2 = await prisma.venteLigne.findMany({
    where: { produitId: p2.id, vente: { typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false, statut: 'VALIDEE' } },
    include: { vente: { select: { numero: true, date: true } } },
    orderBy: { vente: { date: 'asc' } }
  })

  console.log('')
  console.log('=== EXEMPLE 2: ETB-00016 (CARREAU CERAMIKING 30001 30*30) ===')
  const numeros2 = ventes2.map(v => v.vente.numero)
  const mouvs2 = await prisma.mouvement.findMany({
    where: { observation: { in: numeros2.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) }, produitId: p2.id }
  })
  const mvtObs2 = {}
  for (const m of mouvs2) mvtObs2[m.observation] = (mvtObs2[m.observation] || 0) + 1
  
  let surDeduit2 = 0
  let nbModif2 = 0
  for (const v of ventes2) {
    const nbModifs = mvtObs2[`Modif Vente ${v.vente.numero}`] || 0
    const aVente = mvtObs2[`Vente ${v.vente.numero}`] || 0
    if (nbModifs > 0 && aVente === 0) {
      surDeduit2 += v.quantite * nbModifs
      nbModif2++
    }
  }

  console.log(`  Stock actuel DB: ${s2.quantite}`)
  console.log(`  Ventes totales: ${ventes2.reduce((s, v) => s + v.quantite, 0)}`)
  console.log(`  Ventes modifiées: ${nbModif2}`)
  console.log(`  Sur-déduction estimée: ${surDeduit2}`)
  console.log(`  Stock après correction: ${s2.quantite + surDeduit2}`)

  // ====== EXEMPLE 3: ETB-00044 ======
  const p3 = await prisma.produit.findFirst({ where: { code: 'ETB-00044' } })
  const s3 = await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p3.id, magasinId: 1, entiteId: 1 } } })

  const ventes3 = await prisma.venteLigne.findMany({
    where: { produitId: p3.id, vente: { typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false, statut: 'VALIDEE' } },
    include: { vente: { select: { numero: true, date: true } } },
    orderBy: { vente: { date: 'asc' } }
  })

  console.log('')
  console.log('=== EXEMPLE 3: ETB-00044 (CONTREPLAQUET N 4) ===')
  const numeros3 = ventes3.map(v => v.vente.numero)
  const mouvs3 = await prisma.mouvement.findMany({
    where: { observation: { in: numeros3.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) }, produitId: p3.id }
  })
  const mvtObs3 = {}
  for (const m of mouvs3) mvtObs3[m.observation] = (mvtObs3[m.observation] || 0) + 1
  
  let surDeduit3 = 0
  let nbModif3 = 0
  for (const v of ventes3) {
    const nbModifs = mvtObs3[`Modif Vente ${v.vente.numero}`] || 0
    const aVente = mvtObs3[`Vente ${v.vente.numero}`] || 0
    if (nbModifs > 0 && aVente === 0) {
      surDeduit3 += v.quantite * nbModifs
      nbModif3++
    }
  }

  console.log(`  Stock actuel DB: ${s3.quantite}`)
  console.log(`  Ventes totales: ${ventes3.reduce((s, v) => s + v.quantite, 0)}`)
  console.log(`  Ventes modifiées: ${nbModif3}`)
  console.log(`  Sur-déduction estimée: ${surDeduit3}`)
  console.log(`  Stock après correction: ${s3.quantite + surDeduit3}`)

  console.log('')
  console.log('=== RÉSUMÉ DU FONCTIONNEMENT ===')
  console.log('Le bug est dans le handler PATCH (modification de vente):')
  console.log('1. À la création d\'une vente LIVRAISON_IMMEDIATE → stock déduit correctement')
  console.log('2. Quand on MODIFIE cette vente (PATCH) → le code rembourse 0 unité')
  console.log('   (car il utilise quantiteLivree qui est 0 pour les LIVRAISON_IMMEDIATE)')
  console.log('3. Puis il re-déduit le stock → double déduction à chaque modification !')
  console.log('')
  console.log('La correction:')
  console.log('- On ajoute au stock la quantité déduite en trop pour chaque vente modifiée')
  console.log('- Les mouvements (traçabilité) sont déjà corrects')
  console.log('- Après correction, le stock correspondra à la réalité des ventes')
  console.log('')
  console.log('Limite de cette approche:')
  console.log('- Si une vente a changé DE quantité entre la création et la modification,')
  console.log('  on utilise la quantité actuelle (dernière modification) comme base')
  console.log('- L\'écart est minime dans ce cas')

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
