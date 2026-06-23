import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'


export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'archives:view')
    if (authError) return authError

    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 10000))
    const skip = (page - 1) * limit
    const dateDebut = req.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = req.nextUrl.searchParams.get('dateFin')?.trim()
    const clientIdParam = req.nextUrl.searchParams.get('clientId')?.trim()

    const where: any = { entiteId: session.entiteId }

    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut + 'T00:00:00')
      if (dateFin) where.date.lte = new Date(dateFin + 'T23:59:59')
    }

    if (clientIdParam) {
      const cId = Number(clientIdParam)
      if (Number.isInteger(cId) && cId > 0) {
        where.clientId = cId
      }
    }

    const [archives, total, totalsAgg] = await Promise.all([
      prisma.archiveVente.findMany({
        where,
        skip,
        take: limit,
        include: {
          lignes: {
            select: { id: true, venteId: true, designation: true, quantite: true, prixUnitaire: true, montant: true }
          },
          client: { select: { nom: true } },
          utilisateur: { select: { nom: true } },
          magasin: { select: { code: true, nom: true } },
        },
        orderBy: { date: 'desc' }
      }),
      prisma.archiveVente.count({ where }),
      prisma.archiveVente.aggregate({ where, _sum: { montantTotal: true } }),
    ])

    return NextResponse.json({
      data: archives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      totals: {
        montantTotal: totalsAgg._sum.montantTotal || 0,
      }
    })
  } catch (e) {
    await apiCatch(e, 'api/archives/ventes')
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'archives:create')
    if (authError) return authError

    const body = await req.json()
    const { 
      numeroFactureOrigine, 
      date, 
      magasinId, 
      clientId, 
      clientLibre, 
      montantTotal, 
      observation, 
      lignes 
    } = body

    // Blindage numérique
    const rawMagasinId = Number(magasinId)
    const rawClientId = clientId ? Number(clientId) : null
    const rawMontantTotal = Number(montantTotal)

    if (isNaN(rawMagasinId)) {
       return NextResponse.json({ error: 'ID Magasin invalide' }, { status: 400 })
    }

    // Création de l'archive pure (aucune écriture de stock ou compte client)
    const archive = await prisma.archiveVente.create({
      data: {
        numeroFactureOrigine,
        date: new Date(date),
        magasinId: rawMagasinId,
        entiteId: await getEntiteId(session),
        utilisateurId: session.userId,
        clientId: (rawClientId && !isNaN(rawClientId)) ? rawClientId : null,
        clientLibre,
        montantTotal: isNaN(rawMontantTotal) ? 0 : rawMontantTotal,
        observation,
        lignes: {
          create: (lignes || []).map((l: any) => {
             const q = Number(l.quantite)
             const pu = Number(l.prixUnitaire)
             const m = Number(l.montant)
             return {
                designation: String(l.designation || 'Article sans nom'),
                quantite: isNaN(q) ? 0 : q,
                prixUnitaire: isNaN(pu) ? 0 : pu,
                montant: isNaN(m) ? 0 : m
             }
          })
        }
      },
      include: { lignes: true }
    })

    return NextResponse.json(archive)
  } catch (e) {
    await apiCatch(e, 'api/archives/ventes')
    return NextResponse.json({ error: 'Erreur lors de la création de l\'archive' }, { status: 500 })
  }
}
