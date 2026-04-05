import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserCharge } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse } from '@/lib/caisse'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const typeParam = request.nextUrl.searchParams.get('type')?.trim()
  const rubriqueParam = request.nextUrl.searchParams.get('rubrique')?.trim()
  const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
  const q = request.nextUrl.searchParams.get('q')?.trim()

  const where: {
    date?: { gte: Date; lte: Date }
    type?: string
    rubrique?: string
    magasinId?: number | null
    entiteId?: number
    OR?: any[]
  } = {}

  // Filtrer par entité de la session (sauf SUPER_ADMIN qui voit tout)
  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (typeParam && ['FIXE', 'VARIABLE'].includes(typeParam)) {
    where.type = typeParam
  }

  if (rubriqueParam) {
    where.rubrique = rubriqueParam
  }

  if (magasinIdParam) {
    const magId = Number(magasinIdParam)
    if (Number.isInteger(magId) && magId > 0) {
      where.magasinId = magId
    }
  }

  if (q) {
    where.OR = [
      { rubrique: { contains: q } },
      { observation: { contains: q } },
      { beneficiaire: { contains: q } },
    ]
  }

  const [charges, total] = await Promise.all([
    prisma.charge.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { id: true, code: true, nom: true } },
        entite: { select: { id: true, code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    }),
    prisma.charge.count({ where })
  ])

  return NextResponse.json({
    charges,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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

  try {
    const body = await request.json()
    const now = new Date()
    let date = now
    if (body?.date) {
      const [y, m, d] = String(body.date).split('-').map(Number)
      date = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
    }
    const magasinId = body?.magasinId != null ? Number(body.magasinId) : null
    const type = ['FIXE', 'VARIABLE'].includes(String(body?.type || '').toUpperCase())
      ? String(body.type).toUpperCase()
      : 'VARIABLE'
    const rubrique = String(body?.rubrique || '').trim()
    const beneficiaire = body?.beneficiaire != null ? String(body.beneficiaire).trim() || null : null
    const montant = Math.max(0, Number(body?.montant) || 0)
    const observation = body?.observation != null ? String(body.observation).trim() || null : null

    if (!rubrique) {
      return NextResponse.json({ error: 'Rubrique requise.' }, { status: 400 })
    }
    if (montant <= 0) {
      return NextResponse.json({ error: 'Montant doit être supérieur à 0.' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)

    if (magasinId != null) {
      const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
      if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
      if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
      }
    }

    const charge = await prisma.charge.create({
      data: {
        date,
        magasinId,
        entiteId: entiteId,
        utilisateurId: session.userId,
        type,
        rubrique,
        beneficiaire,
        montant,
        observation,
      },
      include: {
        magasin: { select: { code: true, nom: true } },
        entite: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    // Comptabilisation automatique
    try {
      await comptabiliserCharge({
        chargeId: charge.id,
        date,
        montant,
        rubrique,
        libelle: observation,
        utilisateurId: session.userId,
        magasinId,
      })
    } catch (comptaError) {
      console.error('Erreur comptabilisation charge:', comptaError)
    }

    // ✅ SYNCHRO CAISSE : Toute charge est considérée comme une sortie de caisse immédiate (ESPECES)
    await enregistrerMouvementCaisse({
      magasinId: magasinId || 1,
      utilisateurId: session.userId,
      montant,
      type: 'SORTIE',
      motif: `Charge : ${rubrique}${observation ? ' (' + observation + ')' : ''}`,
      date
    })

    revalidatePath('/dashboard/charges')
    revalidatePath('/api/charges')

    return NextResponse.json(charge)
  } catch (e) {
    console.error('POST /api/charges:', e)
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}
