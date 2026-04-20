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
    statut: { in: ['VALIDE', 'VALIDEE'] }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (clientId) {
    where.clientId = Number(clientId)
  }

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }

  try {
    const stats = await prisma.vente.groupBy({
      by: ['clientId', 'clientLibre'],
      where,
      _sum: {
        montantTotal: true,
        montantPaye: true,
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          montantTotal: 'desc'
        }
      }
    })

    const detailedStats = await Promise.all(stats.map(async (item) => {
      let nom = item.clientLibre || 'Client Divers'
      let telephone = ''
      let pointsFidelite = 0
      
      if (item.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: item.clientId },
          select: { nom: true, telephone: true, pointsFidelite: true }
        })
        if (client) {
          nom = client.nom
          telephone = client.telephone || ''
          pointsFidelite = client.pointsFidelite || 0
        }
      }

      return {
        clientId: item.clientId,
        nom,
        telephone,
        pointsFidelite,
        nombreVentes: item._count.id,
        caTotal: item._sum.montantTotal || 0,
        totalPaye: item._sum.montantPaye || 0,
        soldeDu: (item._sum.montantTotal || 0) - (item._sum.montantPaye || 0)
      }
    }))

    return NextResponse.json(detailedStats)
  } catch (error) {
    console.error('Erreur Rapport CA Clients:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
