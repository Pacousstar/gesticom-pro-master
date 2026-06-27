import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  // 1. Identifier toutes les ventes LIVRAISON_IMMEDIATE modifiées (PATCH)
  const ventes = await prisma.vente.findMany({
    where: {
      typeVente: 'LIVRAISON_IMMEDIATE',
      retraitDiffere: false,
      statut: 'VALIDEE',
    },
    include: { lignes: true },
  })

  // Récupérer tous les mouvements
  const numeros = ventes.map(v => v.numero)
  const mouvements = await prisma.mouvement.findMany({
    where: { observation: { in: numeros.flatMap(n => [`Vente ${n}`, `Modif Vente ${n}`]) } }
  })

  const mvtParObs = {}
  for (const m of mouvements) {
    mvtParObs[m.observation] = (mvtParObs[m.observation] || 0) + 1
  }

  // Calculer sur-déduction par produit
  const surDeductionParProduit = {}
  const lignesCorrigees = []

  for (const v of ventes) {
    const nbModifs = mvtParObs[`Modif Vente ${v.numero}`] || 0
    const aVente = mvtParObs[`Vente ${v.numero}`] || 0
    if (nbModifs > 0 && aVente === 0) {
      for (const l of v.lignes) {
        surDeductionParProduit[l.produitId] = (surDeductionParProduit[l.produitId] || 0) + (l.quantite * nbModifs)
        lignesCorrigees.push({
          vente: v.numero,
          produitId: l.produitId,
          quantite: l.quantite,
          nbModifs,
          surDeduit: l.quantite * nbModifs
        })
      }
    }
  }

  const produitIds = Object.keys(surDeductionParProduit).map(Number)
  const produits = await prisma.produit.findMany({
    where: { id: { in: produitIds } },
    select: { id: true, code: true, designation: true }
  })
  const prodMap = {}
  for (const p of produits) prodMap[p.id] = p

  // Afficher le résumé
  let totalCorrection = 0
  console.log('=== PLAN DE CORRECTION ===')
  for (const pid of Object.keys(surDeductionParProduit).sort((a, b) => surDeductionParProduit[b] - surDeductionParProduit[a])) {
    const p = prodMap[Number(pid)]
    if (p) {
      console.log(`${p.code} ${p.designation}: +${surDeductionParProduit[pid]} unités`)
    }
    totalCorrection += surDeductionParProduit[pid]
  }
  console.log(`\nTotal à restituer: ${totalCorrection} unités sur ${Object.keys(surDeductionParProduit).length} produits`)

  // Exécuter la correction
  console.log('\n=== EXÉCUTION DE LA CORRECTION ===')
  let produitsCorriges = 0
  for (const pidStr of Object.keys(surDeductionParProduit)) {
    const pid = Number(pidStr)
    const qteARestituer = surDeductionParProduit[pid]

    // Vérifier que le stock existe
    const stock = await prisma.stock.findUnique({
      where: { produitId_magasinId_entiteId: { produitId: pid, magasinId: 1, entiteId: 1 } }
    })

    if (!stock) {
      console.log(`  ⚠ Produit ${pid} (${prodMap[pid]?.code || 'inconnu'}): pas de stock trouvé`)
      continue
    }

    // Créer mouvement de correction
    await prisma.mouvement.create({
      data: {
        type: 'ENTREE',
        produitId: pid,
        magasinId: 1,
        entiteId: 1,
        utilisateurId: 1,
        quantite: qteARestituer,
        dateOperation: new Date(),
        observation: `Correction masse: restitution sur-déduction PATCH vente (${qteARestituer}U)`,
      }
    })

    // Mettre à jour le stock
    await prisma.stock.update({
      where: { produitId_magasinId_entiteId: { produitId: pid, magasinId: 1, entiteId: 1 } },
      data: { quantite: { increment: qteARestituer } }
    })

    produitsCorriges++
    if (produitsCorriges % 20 === 0) {
      console.log(`  → ${produitsCorriges}/${Object.keys(surDeductionParProduit).length} produits traités`)
    }
  }

  console.log(`\n✓ Correction terminée: ${produitsCorriges} produits mis à jour`)

  // Audit final - stocks négatifs
  console.log('\n=== AUDIT FINAL ===')
  const stocksNegatifs = await prisma.stock.findMany({
    where: { quantite: { lt: 0 } },
    include: { produit: { select: { code: true, designation: true } } }
  })
  if (stocksNegatifs.length === 0) {
    console.log('Aucun stock négatif ✓')
  } else {
    console.log(`⚠ ${stocksNegatifs.length} produit(s) encore en négatif:`)
    for (const s of stocksNegatifs) {
      console.log(`  ${s.produit.code} ${s.produit.designation}: ${s.quantite}`)
    }
  }

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
