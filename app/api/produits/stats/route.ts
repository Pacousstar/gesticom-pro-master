import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const [total, enStockRows] = await Promise.all([
      prisma.produit.count({ where: { actif: true, entiteId } }),
      prisma.stock.groupBy({
        by: ['produitId'],
        where: { quantite: { gt: 0 }, entiteId },
      }),
    ])

    return NextResponse.json({ total, enStock: enStockRows.length })
  } catch (e) {
    await apiCatch(e, 'api/produits/stats')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}