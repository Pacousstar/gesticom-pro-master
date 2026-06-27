import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const corrections = [
  { code: 'VERN-218', nouveauStock: 2, raison: 'Double déduction via PATCH vente (Modif Vente)' },
  { code: 'DIVE-018', nouveauStock: 0, raison: 'Stock négatif suite à modification vente' },
]

try {
  for (const c of corrections) {
    const produit = await prisma.produit.findFirst({ where: { code: c.code } })
    if (!produit) { console.error(`Produit ${c.code} introuvable`); continue }

    const stock = await prisma.stock.findUnique({
      where: { produitId_magasinId_entiteId: { produitId: produit.id, magasinId: 1, entiteId: 1 } }
    })
    if (!stock) { console.error(`Stock ${c.code} introuvable`); continue }

    const diff = c.nouveauStock - stock.quantite
    console.log(`${c.code} (${produit.designation}): ${stock.quantite} → ${c.nouveauStock} (${diff > 0 ? '+' : ''}${diff})`)

    if (diff !== 0) {
      // Créer mouvement d'ajustement
      await prisma.mouvement.create({
        data: {
          type: diff > 0 ? 'ENTREE' : 'SORTIE',
          produitId: produit.id,
          magasinId: 1,
          entiteId: 1,
          utilisateurId: 1,
          quantite: Math.abs(diff),
          dateOperation: new Date(),
          observation: `Correction stock: ${c.raison}`,
        }
      })
      await prisma.stock.update({
        where: { produitId_magasinId_entiteId: { produitId: produit.id, magasinId: 1, entiteId: 1 } },
        data: { quantite: c.nouveauStock }
      })
      console.log(`  ✓ Corrigé (${diff > 0 ? '+' : ''}${diff})`)
    } else {
      console.log(`  = Déjà correct`)
    }
  }

  // Audit complet des stocks négatifs restants
  console.log('\n=== AUDIT POST-CORRECTION ===')
  const stocksNegatifs = await prisma.stock.findMany({
    where: { quantite: { lt: 0 } },
    include: { produit: { select: { code: true, designation: true } } }
  })
  if (stocksNegatifs.length === 0) {
    console.log('Aucun stock négatif restant ✓')
  } else {
    for (const s of stocksNegatifs) {
      console.log(`${s.produit.code} ${s.produit.designation}: ${s.quantite}`)
    }
  }
} catch(e) { console.error(e) } finally { await prisma.$disconnect() }
