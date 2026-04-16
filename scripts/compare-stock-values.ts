import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function compareStock() {
  console.log('--- COMPARAISON DES VALEURS DE STOCK ---')

  // 1. Somme des quantités dans la table 'Stock'
  const stockTable = await prisma.stock.aggregate({
    _sum: { quantite: true }
  })
  const qtyStockTable = stockTable._sum.quantite || 0

  // 2. Somme des quantités dans la table 'Mouvement'
  const mvtTable = await prisma.mouvement.aggregate({
    _sum: { quantite: true }
  })
  const qtyMvtTable = mvtTable._sum.quantite || 0

  // 3. Valeur financière du stock (PAMP * Stock)
  const stocks = await prisma.stock.findMany({
    include: { produit: true }
  })
  
  let valPampStock = 0
  stocks.forEach(s => {
    valPampStock += (s.quantite * (s.produit.pamp || s.produit.prixAchat || 0))
  })

  // 4. Nombre de produits au catalogue
  const countProduits = await prisma.produit.count()

  console.log({
    qtyStockTable,
    qtyMvtTable,
    valPampStock,
    countProduits,
    diffQty: qtyStockTable - qtyMvtTable
  })
}

compareStock()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
