import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const magasinId = request.nextUrl.searchParams.get('magasinId')
  const produitId = request.nextUrl.searchParams.get('produitId')
  const type = request.nextUrl.searchParams.get('type') // ENTREE | SORTIE

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const entiteId = await getEntiteId(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    where.entiteId = entiteId
  }

  if (dateDebut && dateFin) {
    const endDate = new Date(dateFin)
    endDate.setHours(23, 59, 59, 999)
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: endDate,
    }
  }

  if (magasinId) where.magasinId = Number(magasinId)
  if (produitId) where.produitId = Number(produitId)
  if (type) where.type = type

  try {
    const [mouvements, total, summary] = await Promise.all([
      prisma.mouvement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          produit: { select: { code: true, designation: true, prixAchat: true } },
          magasin: { select: { nom: true } },
          utilisateur: { select: { nom: true } },
        },
      }),
      prisma.mouvement.count({ where }),
      prisma.mouvement.groupBy({
        by: ['type'],
        where,
        _sum: { quantite: true }
      })
    ])

    const totals = {
      entree: summary.find(s => s.type === 'ENTREE')?._sum?.quantite || 0,
      sortie: summary.find(s => s.type === 'SORTIE')?._sum?.quantite || 0,
    }

    return NextResponse.json({
      mouvements,
      totals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Erreur Rapport Mouvements:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des mouvements' }, { status: 500 })
  }
}
