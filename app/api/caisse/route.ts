import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserCaisse } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'

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
  const entiteIdFilter = await getEntiteIdOrAll(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
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
    const now = new Date()
    let date = now
    if (body?.date) {
      const raw = String(body.date).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number)
        const tmp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
        if (!Number.isNaN(tmp.getTime())) date = tmp
      } else {
        const tmp = new Date(raw)
        if (!Number.isNaN(tmp.getTime())) date = tmp
      }
    }
    const magasinId = Number(body?.magasinId)
    const type = ['ENTREE', 'SORTIE'].includes(String(body?.type || '').toUpperCase())
      ? String(body.type).toUpperCase()
      : 'ENTREE'
    const motif = String(body?.motif || '').trim()
    const montant = Math.max(0, Number(body?.montant) || 0)
    const observation = body?.observation ? String(body.observation).trim() : null
    const sousType = body?.sousType ? String(body.sousType).trim() : 'MANUEL'
    const sousTypesValides = ['MANUEL', 'PRODUIT', 'APPROVISIONNEMENT', 'CHARGE', 'RETRAIT']
    const sousTypeFinal = sousTypesValides.includes(sousType) ? sousType : 'MANUEL'

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

    const result = await prisma.$transaction(async (tx) => {
      // RC4 : Utiliser enregistrerMouvementCaisse au lieu de tx.caisse.create
      // pour garantir le uppercase du motif et la cohérence
      const operation = await enregistrerMouvementCaisse({
        magasinId,
        type: type as 'ENTREE' | 'SORTIE',
        motif,
        montant,
        utilisateurId: session.userId,
        entiteId: magasin.entiteId,
        date,
        observation: observation ?? undefined,
        sousType: sousTypeFinal,
      }, tx)

      if (!operation) {
        throw new Error('Erreur lors de la création de l\'opération caisse.')
      }

      // Comptabilisation automatique
      await comptabiliserCaisse({
        caisseId: operation.id,
        date,
        type: type as 'ENTREE' | 'SORTIE',
        montant,
        motif: operation.motif,
        utilisateurId: session.userId,
        entiteId: magasin.entiteId,
        sousType: sousTypeFinal,
      }, tx)

      // RC1 : Recalculer le solde caisse après chaque mouvement
      await recalculerSoldeCaisse(magasinId, tx)

      // Refetch avec includes pour la réponse
      return await tx.caisse.findUnique({
        where: { id: operation.id },
        include: {
          magasin: { select: { id: true, code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })
    }, { timeout: 20000 })

    revalidatePath('/dashboard/caisse')
    revalidatePath('/api/caisse')

    return NextResponse.json(result)
  } catch (e) {
    console.error('POST /api/caisse:', e)
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}