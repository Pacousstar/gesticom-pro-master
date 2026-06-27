import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  // Trouver tous les mouvements de correction
  const corrections = await prisma.mouvement.findMany({
    where: {
      OR: [
        { observation: { contains: 'Correction stock:' } },
        { observation: { contains: 'Correction masse:' } },
      ]
    }
  })

  console.log(`Mouvements de correction trouvés: ${corrections.length}`)

  // Agréger par produit
  const parProduit = {}
  for (const m of corrections) {
    if (!parProduit[m.produitId]) parProduit[m.produitId] = 0
    parProduit[m.produitId] += m.quantite
  }

  console.log('\n=== ANNULATION DES CORRECTIONS ===')
  let produitsAnnules = 0
  for (const [produitId, qte] of Object.entries(parProduit)) {
    const pid = Number(produitId)
    const stock = await prisma.stock.findUnique({
      where: { produitId_magasinId_entiteId: { produitId: pid, magasinId: 1, entiteId: 1 } }
    })
    if (!stock) {
      console.log(`  ⚠ Produit ${pid}: pas de stock trouvé`)
      continue
    }

    // Inverser le mouvement
    await prisma.mouvement.create({
      data: {
        type: 'SORTIE',
        produitId: pid,
        magasinId: 1,
        entiteId: 1,
        utilisateurId: 1,
        quantite: qte,
        dateOperation: new Date(),
        observation: `Annulation correction stock: retour à l'état initial (-${qte}U)`,
      }
    })

    // Décrémenter le stock
    await prisma.stock.update({
      where: { produitId_magasinId_entiteId: { produitId: pid, magasinId: 1, entiteId: 1 } },
      data: { quantite: { decrement: qte } }
    })

    const p = await prisma.produit.findUnique({ where: { id: pid }, select: { code: true, designation: true } })
    console.log(`  ${p?.code || pid} ${p?.designation || ''}: -${qte} (${stock.quantite} → ${stock.quantite - qte})`)
    produitsAnnules++
  }

  // Supprimer les mouvements de correction originaux
  const ids = corrections.map(m => m.id)
  await prisma.mouvement.deleteMany({ where: { id: { in: ids } } })
  console.log(`\n✓ ${ids.length} mouvements de correction supprimés`)
  console.log(`✓ ${produitsAnnules} produits restaurés à leur état initial`)

  // Audit final
  console.log('\n=== AUDIT FINAL ===')
  const stocksNegatifs = await prisma.stock.findMany({
    where: { quantite: { lt: 0 } },
    include: { produit: { select: { code: true, designation: true } } }
  })
  if (stocksNegatifs.length === 0) {
    console.log('Aucun stock négatif')
  } else {
    console.log(`${stocksNegatifs.length} stock(s) négatif(s):`)
    for (const s of stocksNegatifs) {
      console.log(`  ${s.produit.code} ${s.produit.designation}: ${s.quantite}`)
    }
  }

} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
