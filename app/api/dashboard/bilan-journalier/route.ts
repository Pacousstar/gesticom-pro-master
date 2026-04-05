import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)

  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const stats = await prisma.vente.aggregate({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        statut: { in: ['VALIDE', 'VALIDEE'] },
        ...(entiteId ? { entiteId } : {}),
      },
      _sum: {
        montantTotal: true,
      },
      _count: {
        id: true,
      },
    })

    return NextResponse.json({
      ca: stats._sum.montantTotal || 0,
      count: stats._count.id || 0,
      date: now.toISOString(),
    })
  } catch (e) {
    console.error('Bilan journalier error:', e)
    return NextResponse.json({ ca: 0, count: 0 }, { status: 500 })
  }
}
