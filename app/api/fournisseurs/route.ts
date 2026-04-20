import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const forbidden = requirePermission(session, 'fournisseurs:view')
  if (forbidden) return forbidden

  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entiteId = await getEntiteId(session)
  const where: any = { actif: true }

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

  const complet = request.nextUrl.searchParams.get('complet') === '1'
  if (complet) {
    const list = await prisma.fournisseur.findMany({
      where,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true }
    })
    const res = NextResponse.json(list)
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const q = String(request.nextUrl.searchParams.get('q') || '').trim()
  
  if (q) {
    where.OR = [
      { nom: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { telephone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } }
    ]
  }

  const [total, list] = await Promise.all([
    prisma.fournisseur.count({ where }),
    prisma.fournisseur.findMany({
      where,
      orderBy: { nom: 'asc' },
      select: { id: true, code: true, nom: true, telephone: true, email: true, ncc: true, localisation: true, numeroCamion: true, soldeInitial: true, avoirInitial: true },
      skip,
      take: limit,
    })
  ])

  const paginated = list

  const fournisseurIds = paginated.map((f: any) => f.id)
  let detteByFournisseur: Record<number, number> = {}
  
  if (fournisseurIds.length > 0) {
    // 1. Dettes Globales (Achats VALIDE)
    const Dettes_Globales = await prisma.achat.groupBy({
      by: ['fournisseurId'],
      where: { fournisseurId: { in: fournisseurIds }, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montantTotal: true },
    })
    
    // 2. Paiements Globaux (Règlements VALIDE)
    const Paiements_Globaux = await prisma.reglementAchat.groupBy({
      by: ['fournisseurId'],
      where: { fournisseurId: { in: fournisseurIds }, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montant: true }
    })

    const detteMap = Object.fromEntries(Dettes_Globales.map(r => [r.fournisseurId, r._sum?.montantTotal || 0]))
    const payeMap = Object.fromEntries(Paiements_Globaux.map(r => [r.fournisseurId, r._sum?.montant || 0]))

    for (const fId of fournisseurIds) {
      detteByFournisseur[fId] = (detteMap[fId] || 0) - (payeMap[fId] || 0)
    }
  }

  const result = paginated.map((f: any) => ({
    ...f,
    // Dette Totale = (Achats - Paiements) + SoldeInitial - AvoirInitial
    dette: (detteByFournisseur[f.id] ?? 0) + (f.soldeInitial || 0) - (f.avoirInitial || 0)
  }))

  const res = NextResponse.json({
    data: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const forbidden = requirePermission(session, 'fournisseurs:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    let code = body?.code != null ? String(body.code).trim() || null : null
    const nom = String(body?.nom || '').trim()
    const telephone = body?.telephone != null ? String(body.telephone).trim() || null : null
    const email = body?.email != null ? String(body.email).trim() || null : null
    const ncc = body?.ncc != null ? String(body.ncc).trim() || null : null
    const localisation = body?.localisation != null ? String(body.localisation).trim() || null : null
    const numeroCamion = body?.numeroCamion != null ? String(body.numeroCamion).trim() || null : null
    let soldeInitial = Number(body?.soldeInitial)
    if (isNaN(soldeInitial)) soldeInitial = 0
    let avoirInitial = Number(body?.avoirInitial)
    if (isNaN(avoirInitial)) avoirInitial = 0

    if (!nom) {
      return NextResponse.json({ error: 'Nom du fournisseur requis.' }, { status: 400 })
    }

    // Génération automatique du code si non fourni
    if (!code) {
      const count = await prisma.fournisseur.count()
      const prefix = nom.charAt(0).toUpperCase() || 'F'
      code = `${String(count + 1).padStart(6, '0')}${prefix}`
    }

    const f = await prisma.fournisseur.create({
      data: { 
        code, 
        nom, 
        telephone, 
        email, 
        ncc, 
        localisation, 
        numeroCamion, 
        soldeInitial, 
        avoirInitial, 
        actif: true,
        entiteId: session?.entiteId || 1
      },
    })
    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/fournisseurs')
    revalidatePath('/api/fournisseurs')

    return NextResponse.json(f)
  } catch (e: any) {
    console.error('POST /api/fournisseurs:', e)
    return NextResponse.json({ error: `Erreur serveur: ${e.message || 'Inconnue'}` }, { status: 500 })
  }
}
