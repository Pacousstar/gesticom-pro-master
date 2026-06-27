import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  const codes = ['VERN-218', 'ETB-00016', 'ETB-00044', 'ETB-00020', 'ETB-00022',
    'ETB-00069', 'ETB-00071', 'ETB-00072', 'ETB-00001', 'ETB-00004', 'ETB-00005']

  for (const code of codes) {
    const p = await prisma.produit.findFirst({ where: { code } })
    if (!p) { console.log(`\n${code}: produit introuvable`); continue }

    const stock = await prisma.stock.findUnique({
      where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } }
    })
    if (!stock) { console.log(`\n${code}: stock introuvable`); continue }

    const entrees = await prisma.mouvement.aggregate({
      where: { produitId: p.id, magasinId: 1, type: 'ENTREE' },
      _sum: { quantite: true }
    })
    const sorties = await prisma.mouvement.aggregate({
      where: { produitId: p.id, magasinId: 1, type: 'SORTIE' },
      _sum: { quantite: true }
    })

    const totalEntrees = entrees._sum.quantite || 0
    const totalSorties = sorties._sum.quantite || 0
    const stockAttendu = stock.quantiteInitiale + totalEntrees - totalSorties

    // Ventes LIVRAISON_IMMEDIATE
    const ventes = await prisma.venteLigne.findMany({
      where: {
        produitId: p.id,
        vente: { typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false, statut: 'VALIDEE' }
      },
      include: { vente: { select: { numero: true } } }
    })
    const totalVendu = ventes.reduce((s, l) => s + l.quantite, 0)

    // Ventes modifiées
    const numeros = [...new Set(ventes.map(v => v.vente.numero))]
    const mouvs = await prisma.mouvement.findMany({
      where: { observation: { in: numeros.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) }, produitId: p.id }
    })
    const mvtParObs = {}
    for (const m of mouvs) mvtParObs[m.observation] = (mvtParObs[m.observation] || 0) + 1

    let totalSurDeduit = 0
    let nbVentesModifiees = 0
    for (const n of numeros) {
      const nbModifs = mvtParObs[`Modif Vente ${n}`] || 0
      const aVente = mvtParObs[`Vente ${n}`] || 0
      if (nbModifs > 0 && aVente === 0) {
        const lignes = ventes.filter(v => v.vente.numero === n)
        for (const l of lignes) totalSurDeduit += l.quantite * nbModifs
        nbVentesModifiees++
      }
    }

    console.log(`\n====== ${code} - ${p.designation} ======`)
    console.log(`Stock initial en DB: ${stock.quantiteInitiale}`)
    console.log(`Achats (entrées):   +${totalEntrees}`)
    console.log(`Ventes (sorties):   -${totalSorties}`)
    console.log(`Stock attendu (init+ent-sor): ${stockAttendu}`)
    console.log(`Stock actuel DB:              ${stock.quantite}`)
    console.log(`Écart DB vs attendu:          ${stock.quantite - stockAttendu}`)
    console.log(`\nVentes totales LIVRAISON_IMMEDIATE: ${totalVendu}`)
    console.log(`Ventes modifiées (PATCH):          ${nbVentesModifiees}`)
    console.log(`Sur-déduction estimée:            ${totalSurDeduit}`)
    console.log(`Stock après correction (= actuel + ${totalSurDeduit}): ${stock.quantite + totalSurDeduit}`)
    console.log(`  → Correspond au stock attendu ? ${stock.quantite + totalSurDeduit === stockAttendu ? 'OUI ✓' : 'NON (écart résiduel: ' + (stockAttendu - (stock.quantite + totalSurDeduit)) + ')'}`)
  }
} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
