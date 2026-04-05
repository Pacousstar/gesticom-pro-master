import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:view')
  if (forbidden) return forbidden

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const clientId = request.nextUrl.searchParams.get('clientId')

  const where: any = {
    vente: {
      statut: 'VALIDEE'
    }
  }

  if (dateDebut && dateFin) {
    where.vente.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (clientId) {
    where.vente.clientId = Number(clientId)
  }

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.vente.entiteId = session.entiteId
  }

  try {
    const stats = await prisma.venteLigne.groupBy({
      by: ['produitId', 'designation'],
      where,
      _sum: {
        quantite: true,
        montant: true,
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          montant: 'desc'
        }
      }
    })

    return NextResponse.json(stats.map(s => ({
      produitId: s.produitId,
      designation: s.designation,
      quantiteTotale: s._sum.quantite || 0,
      caTotal: s._sum.montant || 0,
      nombreTransactions: s._count.id
    })))
  } catch (error) {
    console.error('Erreur Rapport CA Produits:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
