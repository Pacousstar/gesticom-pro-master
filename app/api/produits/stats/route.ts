import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { resolveDataFilePath } from '@/lib/resolveDataFile'

/** 
 * Total produits (actifs) et produits avec au moins un stock >0.
 * IMPORTANT: Un produit est affiché uniquement dans son point de vente.
 * Le total doit correspondre au nombre de lignes dans le fichier Excel (3290).
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Compter tous les produits actifs (même les doublons de désignation)
    // Chaque produit est unique par son code et est dans un seul point de vente
    const total = await prisma.produit.count({ where: { actif: true } })
    
    // Produits avec au moins un stock > 0 (groupés par produitId pour éviter les doublons)
    const enStockRows = await prisma.stock.groupBy({
      by: ['produitId'],
      where: { quantite: { gt: 0 } },
    })

    const enStock = enStockRows.length

    return NextResponse.json({ total, enStock })
  } catch (e) {
    console.error('GET /api/produits/stats:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
