import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  const where: any = {
    entiteId,
    statut: { in: ['VALIDE', 'VALIDEE'] },
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  try {
    const ventes = await prisma.vente.findMany({
      where,
      include: {
        client: { select: { nom: true, code: true } },
        utilisateur: { select: { nom: true } },
        magasin: { select: { nom: true } },
        lignes: { select: { designation: true } },
      },
      orderBy: { date: 'desc' },
    })

    const formatted = ventes.map(v => ({
      id: v.id,
      numero: v.numero,
      date: v.date,
      client: v.client?.nom || v.clientLibre || 'Client Comptant',
      montantTotal: v.montantTotal,
      montantPaye: v.montantPaye,
      statutPaiement: v.statutPaiement,
      modePaiement: v.modePaiement,
      vendeur: v.utilisateur.nom,
      magasin: v.magasin.nom,
      produits: v.lignes.map(l => l.designation).join(', ')
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('GET /api/rapports/ventes/liste:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
