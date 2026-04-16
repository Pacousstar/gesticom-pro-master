import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { operations, banqueId } = await request.json()
    if (!banqueId || !Array.isArray(operations)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // Algorithme de rapprochement
    // Pour chaque opération du relevé, on cherche des règlements (ventes ou achats)
    // non lettrés avec le même montant et une date proche (+/- 3 jours)

    const matches = await Promise.all(operations.map(async (op: any) => {
      const montant = Math.abs(Number(op.montant))
      const dateOp = new Date(op.date)
      const dateMin = new Date(dateOp.getTime() - 3 * 24 * 60 * 60 * 1000)
      const dateMax = new Date(dateOp.getTime() + 3 * 24 * 60 * 60 * 1000)

      // Recherche règlements ventes
      const potentialRegs = await prisma.reglementVente.findMany({
        where: {
          montant,
          date: { gte: dateMin, lte: dateMax },
          statut: 'VALIDE'
        },
        include: { client: { select: { nom: true } }, vente: { select: { numero: true } } }
      })

      return {
        ...op,
        suggestions: potentialRegs.map(r => ({
          id: r.id,
          type: 'VENTE',
          montant: r.montant,
          date: r.date,
          libelle: `Règlement Vente ${r.vente?.numero || ''} - ${r.client?.nom || ''}`
        }))
      }
    }))

    return NextResponse.json(matches)
  } catch (error) {
    console.error('Erreur Rapprochement:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
