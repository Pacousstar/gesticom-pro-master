import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 100))
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const where: any = { statut: { in: ['VALIDEE', 'VALIDE'] } }

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.vente = { entiteId: session.entiteId }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  try {
    const [paiements, total] = await Promise.all([
      prisma.reglementVente.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        include: {
          client: { select: { code: true, nom: true } },
          vente: { select: { numero: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.reglementVente.count({ where }),
    ])

    const data = paiements.map(p => ({
      id: p.id,
      date: p.date,
      clientCode: p.client?.code,
      clientNom: p.client?.nom,
      modePaiement: p.modePaiement,
      venteNumero: p.vente?.numero || 'Règlement Compte',
      montant: p.montant,
      observation: p.observation
    }))

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET /api/clients/paiements:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
