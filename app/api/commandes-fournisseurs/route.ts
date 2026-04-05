import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:view') // On réutilise les perms achats pour l'instant
  if (forbidden) return forbidden

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const where: any = {}
  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }

  const [commandes, total] = await Promise.all([
    prisma.commandeFournisseur.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        fournisseur: { select: { nom: true, code: true } },
        magasin: { select: { nom: true } },
        lignes: true
      },
    }),
    prisma.commandeFournisseur.count({ where })
  ])

  return NextResponse.json({
    data: commandes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:create')
  if (forbidden) return forbidden

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
