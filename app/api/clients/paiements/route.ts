import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  const where: any = {}

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.vente = { entiteId: session.entiteId } // Les ReglementVente sont liés à une Vente qui a l'entité
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  try {
    const paiements = await prisma.reglementVente.findMany({
      where,
      include: {
        client: { select: { code: true, nom: true } },
        vente: { select: { numero: true } },
      },
      orderBy: { date: 'desc' },
    })

    let filtered = paiements.map(p => ({
      id: p.id,
      date: p.date,
      clientCode: p.client?.code,
      clientNom: p.client?.nom,
      modePaiement: p.modePaiement,
      venteNumero: p.vente?.numero || 'Règlement Compte',
      montant: p.montant,
      observation: p.observation
    }))

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('GET /api/clients/paiements:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
