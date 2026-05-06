import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const entiteId = await getEntiteId(session)
    const { operations, banqueId } = await request.json()
    
    if (!banqueId || !Array.isArray(operations)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // RB3: Vérifier que la banque appartient à l'entité de l'utilisateur
    const banque = await prisma.banque.findUnique({ where: { id: Number(banqueId) } })
    if (!banque) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }
    if (session.role !== 'SUPER_ADMIN' && banque.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // RB3: Filtrer les règlements par entité
    const whereEntite = session.role === 'SUPER_ADMIN' 
      ? {} 
      : { vente: { entiteId }, achat: { entiteId } }

    // Algorithme de rapprochement
    // Pour chaque opération du relevé, on cherche des règlements (ventes ou achats)
    // non lettrés avec le même montant et une date proche (+/- 3 jours)

    const matches = await Promise.all(operations.map(async (op: any) => {
      const montant = Math.abs(Number(op.montant))
      const dateOp = new Date(op.date)
      const dateMin = new Date(dateOp.getTime() - 3 * 24 * 60 * 60 * 1000)
      const dateMax = new Date(dateOp.getTime() + 3 * 24 * 60 * 60 * 1000)

      // RB7: Recherche règlementsVENTES + règlementsACHATS
      const [regsVente, regsAchat] = await Promise.all([
        // Recherche règlements ventes
        prisma.reglementVente.findMany({
          where: {
            montant,
            date: { gte: dateMin, lte: dateMax },
            statut: 'VALIDE',
            rapproche: false,
            ...whereEntite
          },
          include: { client: { select: { nom: true } }, vente: { select: { numero: true } } }
        }),
        // Recherche règlements achats
        prisma.reglementAchat.findMany({
          where: {
            montant,
            date: { gte: dateMin, lte: dateMax },
            statut: 'VALIDE',
            rapproche: false,
            ...whereEntite
          },
          include: { fournisseur: { select: { nom: true } }, achat: { select: { numero: true } } }
        })
      ])

      return {
        ...op,
        suggestions: [
          ...regsVente.map(r => ({
            id: r.id,
            type: 'VENTE',
            montant: r.montant,
            date: r.date,
            libelle: `Règlement Vente ${r.vente?.numero || ''} - ${r.client?.nom || ''}`
          })),
          ...regsAchat.map(r => ({
            id: r.id,
            type: 'ACHAT',
            montant: r.montant,
            date: r.date,
            libelle: `Règlement Achat ${r.achat?.numero || ''} - ${r.fournisseur?.nom || ''}`
          }))
        ]
      }
    }))

    return NextResponse.json(matches)
  } catch (error) {
    console.error('Erreur Rapprochement:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}