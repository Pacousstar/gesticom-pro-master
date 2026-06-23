import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserCaisse } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { caisseSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const forbidden = requirePermission(session, 'caisse:view')
    if (forbidden) return forbidden

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 100))
    const skip = (page - 1) * limit
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    
    const searchTerm = request.nextUrl.searchParams.get('search')?.trim()
    
    const entiteIdFilter = await getEntiteIdOrAll(session)
    const where: any = {}

    if (entiteIdFilter != null) {
      where.magasin = { entiteId: entiteIdFilter }
    } else {
      const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
      if (entiteIdFromParams) {
        where.magasin = { entiteId: Number(entiteIdFromParams) }
      }
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) where.magasinId = magId
    }

    if (typeParam && ['ENTREE', 'SORTIE'].includes(typeParam)) {
      where.type = typeParam
    }

    if (searchTerm) {
      where.OR = [
        { motif: { contains: searchTerm } },
        { magasin: { nom: { contains: searchTerm } } },
        { magasin: { code: { contains: searchTerm } } },
        { utilisateur: { nom: { contains: searchTerm } } },
      ]
    }

    const [operations, total, totalGlobal, aggregates] = await Promise.all([
      prisma.caisse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          magasin: { select: { id: true, code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      }),
      prisma.caisse.count({ where }),
      prisma.caisse.count({
        where: { magasin: where.magasin, magasinId: where.magasinId },
      }),
      prisma.caisse.groupBy({
        by: ['type'],
        where,
        _sum: { montant: true }
      })
    ])

    const totalEntrees = aggregates.find(a => a.type === 'ENTREE')?._sum.montant || 0
    const totalSorties = aggregates.find(a => a.type === 'SORTIE')?._sum.montant || 0

    return NextResponse.json({ 
      data: operations, 
      total,
      totalGlobal,
      stats: {
        totalEntrees,
        totalSorties,
        solde: totalEntrees - totalSorties
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (e) {
    await apiCatch(e, 'api/caisse')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const forbidden = requirePermission(session, 'caisse:create')
    if (forbidden) return forbidden

    const body = await request.json()
    const validationResult = validateApiRequest(caisseSchema, body)
    if (!validationResult.success) return validationResult.response
    const data = validationResult.data
    const now = new Date()
    let date = now
    if (data.date) {
      const raw = data.date
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number)
        const tmp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
        if (!Number.isNaN(tmp.getTime())) date = tmp
      } else {
        const tmp = new Date(raw)
        if (!Number.isNaN(tmp.getTime())) date = tmp
      }
    }

    const magasin = await prisma.magasin.findUnique({ where: { id: data.magasinId } })
    if (!magasin) {
      return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)

    if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const operation = await enregistrerMouvementCaisse({
        magasinId: data.magasinId,
        type: data.type,
        motif: data.motif,
        montant: data.montant,
        utilisateurId: session.userId,
        entiteId: magasin.entiteId,
        date,
        observation: data.observation ?? undefined,
        sousType: data.sousType,
      }, tx)

      if (!operation) {
        throw new Error('Erreur lors de la création de l\'opération caisse.')
      }

      await comptabiliserCaisse({
        caisseId: operation.id,
        date,
        type: data.type,
        montant: data.montant,
        motif: operation.motif,
        utilisateurId: session.userId,
        entiteId: magasin.entiteId,
        sousType: data.sousType,
      }, tx)

      await recalculerSoldeCaisse(data.magasinId, tx)

      return await tx.caisse.findUnique({
        where: { id: operation.id },
        include: {
          magasin: { select: { id: true, code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })
    }, { timeout: 20000 })

    return NextResponse.json(result)
  } catch (e) {
    await apiCatch(e, 'api/caisse')
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}