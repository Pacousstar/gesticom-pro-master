import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserCaisse } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
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
  
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entiteId = await getEntiteId(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.magasin = { entiteId: Number(entiteIdFromParams) }
    } else if (entiteId > 0) {
      where.magasin = { entiteId }
    }
  } else if (entiteId > 0) {
    where.magasin = { entiteId }
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

  const [operations, total, aggregates] = await Promise.all([
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
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'caisse:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const date = body?.date ? new Date(body.date) : new Date()
    const magasinId = Number(body?.magasinId)
    const type = ['ENTREE', 'SORTIE'].includes(String(body?.type || '').toUpperCase())
      ? String(body.type).toUpperCase()
      : 'ENTREE'
    const motif = String(body?.motif || '').trim()
    const montant = Math.max(0, Number(body?.montant) || 0)

    if (!Number.isInteger(magasinId) || magasinId <= 0) {
      return NextResponse.json({ error: 'Magasin requis.' }, { status: 400 })
    }
    if (!motif) {
      return NextResponse.json({ error: 'Motif requis.' }, { status: 400 })
    }
    if (montant <= 0) {
      return NextResponse.json({ error: 'Montant doit être supérieur à 0.' }, { status: 400 })
    }

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) {
      return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
    }

    // Utiliser l'entité de la session
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const entiteId = await getEntiteId(session)

    // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
    if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
    }

    const operation = await prisma.caisse.create({
      data: {
        date,
        magasinId,
        type,
        motif,
        montant,
        utilisateurId: session.userId,
      },
      include: {
        magasin: { select: { id: true, code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    // Comptabilisation automatique
    try {
      await comptabiliserCaisse({
        caisseId: operation.id,
        date,
        type: type as 'ENTREE' | 'SORTIE',
        montant,
        motif,
        utilisateurId: session.userId,
        entiteId: magasin.entiteId,
      })
    } catch (comptaError) {
      console.error('Erreur comptabilisation caisse:', comptaError)
      // On continue même si la comptabilisation échoue
    }

    revalidatePath('/dashboard/caisse')
    revalidatePath('/api/caisse')

    return NextResponse.json(operation)
  } catch (e) {
    console.error('POST /api/caisse:', e)
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}
