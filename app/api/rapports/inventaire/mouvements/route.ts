import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const produitId = searchParams.get('produitId')
  const magasinId = searchParams.get('magasinId')
  const type = searchParams.get('type')
  const search = searchParams.get('search')?.trim() || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const includeTotals = searchParams.get('includeTotals') === 'true'
  const exportAll = searchParams.get('export') === 'all'

  const entiteId = await getEntiteId(session)
  const where: any = {}

  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    where.entiteId = entiteId
  }

  if (dateDebut && dateFin) {
    try {
      const d1 = new Date(dateDebut + 'T00:00:00')
      const d2 = new Date(dateFin + 'T23:59:59')
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        where.OR = [
          { date: { gte: d1, lte: d2 } },
          { dateOperation: { gte: d1, lte: d2 } }
        ]
      }
    } catch {
      // Ignore les dates invalides
    }
  }

  if (produitId && produitId !== 'TOUT') {
    const n = parseInt(produitId)
    if (!Number.isNaN(n)) where.produitId = n
  }
  if (magasinId && magasinId !== 'TOUT') {
    const n = parseInt(magasinId)
    if (!Number.isNaN(n)) where.magasinId = n
  }
  if (type && type !== 'TOUT') where.type = type

  // Recherche texte sur désignation ou code produit
  if (search) {
      where.produit = {
        OR: [
          { designation: { contains: search } },
          { code: { contains: search } }
        ]
      }
  }

  try {
    // Pour export, retourner toutes les données sans pagination
    if (exportAll) {
      const mouvements = await prisma.mouvement.findMany({
        where,
        include: {
          produit: { select: { designation: true, code: true, unite: true } },
          magasin: { select: { nom: true } },
          utilisateur: { select: { nom: true } },
          transfert: { select: { id: true, numero: true } }
        },
        orderBy: [{ dateOperation: 'desc' }, { id: 'desc' }],
      })

      let totalEntrees = 0
      let totalSorties = 0
      if (includeTotals || exportAll) {
        const [sumEntrees, sumSorties] = await Promise.all([
          prisma.mouvement.aggregate({
            where: { ...where, type: 'ENTREE' },
            _sum: { quantite: true }
          }),
          prisma.mouvement.aggregate({
            where: { ...where, type: 'SORTIE' },
            _sum: { quantite: true }
          })
        ])
        totalEntrees = sumEntrees._sum?.quantite || 0
        totalSorties = sumSorties._sum?.quantite || 0
      }

      const formatted = mouvements.map(m => ({
        id: m.id,
        date: m.date,
        dateOperation: m.dateOperation,
        type: m.type,
        typeRaw: m.type,
        produit: m.produit?.designation || 'Produit inconnu',
        code: m.produit?.code || 'SANS CODE',
        unite: m.produit?.unite || 'u',
        magasin: m.magasin?.nom || 'Magasin inconnu',
        quantite: m.quantite,
        utilisateur: m.utilisateur?.nom || 'Système',
        observation: m.observation,
        referenceTransfertId: m.referenceTransfertId,
        transfertNumero: m.transfert?.numero || null
      }))

      return NextResponse.json({
        data: formatted,
        total: mouvements.length,
        totals: exportAll ? {
          entrees: totalEntrees,
          sorties: totalSorties,
          net: totalEntrees - totalSorties
        } : undefined
      })
    }

    const skip = (page - 1) * limit

    const [mouvements, total, totals] = await Promise.all([
      prisma.mouvement.findMany({
        where,
        include: {
          produit: { select: { designation: true, code: true, unite: true } },
          magasin: { select: { nom: true } },
          utilisateur: { select: { nom: true } },
          transfert: { select: { id: true, numero: true } }
        },
        orderBy: [{ dateOperation: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.mouvement.count({ where }),
      includeTotals ? prisma.mouvement.aggregate({
        where,
        _sum: { quantite: true }
      }) : Promise.resolve({ _sum: { quantite: null } })
    ])

    // Filtrer par type pour les totaux si nécessaire
    let totalEntrees = 0
    let totalSorties = 0
    
    if (includeTotals) {
      const [sumEntrees, sumSorties] = await Promise.all([
        prisma.mouvement.aggregate({
          where: { ...where, type: 'ENTREE' },
          _sum: { quantite: true }
        }),
        prisma.mouvement.aggregate({
          where: { ...where, type: 'SORTIE' },
          _sum: { quantite: true }
        })
      ])
      totalEntrees = sumEntrees._sum?.quantite || 0
      totalSorties = sumSorties._sum?.quantite || 0
    }

    const formatted = mouvements.map(m => ({
      id: m.id,
      date: m.date,
      dateOperation: m.dateOperation,
      type: m.type,
      typeRaw: m.type,
      produit: m.produit?.designation || 'Produit inconnu',
      code: m.produit?.code || 'SANS CODE',
      unite: m.produit?.unite || 'u',
      magasin: m.magasin?.nom || 'Magasin inconnu',
      quantite: m.quantite,
      utilisateur: m.utilisateur?.nom || 'Système',
      observation: m.observation,
      referenceTransfertId: m.referenceTransfertId,
      transfertNumero: m.transfert?.numero || null
    }))

    return NextResponse.json({
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      totals: includeTotals ? {
        entrees: totalEntrees,
        sorties: totalSorties,
        net: totalEntrees - totalSorties
      } : undefined
    })
  } catch (error: any) {
    await apiCatch(error, 'api/rapports/inventaire/mouvements')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
