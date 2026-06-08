import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'commandes:view')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const search = searchParams.get('search')?.trim() || ''
  const statut = searchParams.get('statut')
  const exportAll = searchParams.get('export') === 'all'

  const skip = exportAll ? 0 : (page - 1) * limit

  const entiteId = await getEntiteId(session)
  const where: any = { entiteId }

  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }

  // Filtre par statut
  if (statut && statut !== 'TOUT') {
    where.statut = statut
  }

  // Recherche texte
  if (search) {
    where.OR = [
      { numero: { contains: search } },
      { fournisseur: { nom: { contains: search } } },
      { fournisseurLibre: { contains: search } }
    ]
  }

  const [commandes, total] = await Promise.all([
    prisma.commandeFournisseur.findMany({
      where,
      skip,
      take: exportAll ? undefined : limit,
      orderBy: { date: 'desc' },
      include: {
        fournisseur: { select: { nom: true, code: true, telephone: true } },
        magasin: { select: { nom: true, code: true } },
        lignes: true
      },
    }),
    exportAll ? Promise.resolve(0) : prisma.commandeFournisseur.count({ where })
  ])

  // Calcul des totaux pour export
  let totalMontant = 0
  if (exportAll) {
    const allCommandes = await prisma.commandeFournisseur.findMany({
      where,
      select: { montantTotal: true }
    })
    totalMontant = allCommandes.reduce((acc, c) => acc + (c.montantTotal || 0), 0)
  }

  const response: any = { data: commandes }
  
  if (!exportAll) {
    response.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  }
  
  if (exportAll) {
    response.totals = { montantTotal: totalMontant }
  }

  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'commandes:create')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })

  try {
    const body = await request.json()
    const entiteId = await getEntiteId(session)
    
    // Génération du numéro BC-YYYY-XXX
    const now = new Date()
    const year = now.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)
    
    const count = await prisma.commandeFournisseur.count({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear
        },
        entiteId
      }
    })
    
    const num = `BC-${year}-${String(count + 1).padStart(3, '0')}`
    
    const commande = await prisma.commandeFournisseur.create({
      data: {
        numero: num,
        date: body.date ? new Date(body.date) : new Date(),
        fournisseurId: body.fournisseurId ? Number(body.fournisseurId) : null,
        fournisseurLibre: body.fournisseurLibre,
        magasinId: Number(body.magasinId),
        entiteId,
        utilisateurId: session.userId,
        montantTotal: Number(body.montantTotal) || 0,
        observation: body.observation,
        statut: 'BROUILLON',
        lignes: {
          create: (body.lignes || []).map((l: any) => ({
            produitId: Number(l.produitId),
            designation: l.designation,
            quantite: Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire),
            montant: Number(l.montant)
          }))
        }
      },
      include: {
        lignes: true,
        fournisseur: true
      }
    })

    revalidatePath('/dashboard/commandes-fournisseurs')
    return NextResponse.json(commande)
  } catch (e) {
    console.error('POST /api/commandes-fournisseurs:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
