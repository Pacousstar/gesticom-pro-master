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

  const where: any = {}

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.achat = { entiteId: session.entiteId } // Les ReglementAchat sont liés à un Achat qui a l'entité
  } else if(entiteId) {
      where.achat = { entiteId }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  try {
    const paiements = await prisma.reglementAchat.findMany({
      where,
      include: {
        fournisseur: { select: { code: true, nom: true } },
        achat: { select: { numero: true } },
      },
      orderBy: { date: 'desc' },
    })

    const data = paiements.map(p => ({
      id: p.id,
      date: p.date,
      fournisseurCode: p.fournisseur?.code,
      fournisseurNom: p.fournisseur?.nom || 'Inconnu',
      modePaiement: p.modePaiement,
      achatNumero: p.achat?.numero || 'Règlement Compte',
      montant: p.montant,
      observation: p.observation
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/fournisseurs/paiements:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
