import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { rapprochement } = await request.json()
    const { banqueId, reglementId, type, libelle, montant, date } = rapprochement

    if (!banqueId || !reglementId || !type) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // 1. Marquer le règlement comme rapproché
    if (type === 'VENTE') {
      await prisma.reglementVente.update({
        where: { id: reglementId },
        data: { rapproche: true }
      })
    } else {
      await prisma.reglementAchat.update({
        where: { id: reglementId },
        data: { rapproche: true }
      })
    }

    // 2. Créer une opération bancaire (optionnel - si on veut que le relevé apparaisse dans l'historique banque)
    // On vérifie si une opération similaire existe déjà pour éviter les doublons
    const exists = await prisma.operationBancaire.findFirst({
      where: {
        banqueId,
        montant: type === 'VENTE' ? montant : -montant,
        date: new Date(date)
      }
    })

    if (!exists) {
      // Calcul des soldes (simplifié pour démo, en réel il faudrait une transaction robuste)
      const banque = await prisma.banque.findUnique({ where: { id: banqueId } })
      if (banque) {
        const soldeAvant = banque.soldeActuel
        const montantOp = type === 'VENTE' ? montant : -montant
        const soldeApres = soldeAvant + montantOp

        await prisma.operationBancaire.create({
          data: {
            banqueId,
            date: new Date(date),
            type: type === 'VENTE' ? 'VIREMENT_ENTRANT' : 'VIREMENT_SORTANT',
            libelle: `Rapprochement: ${libelle}`,
            montant: montantOp,
            soldeAvant,
            soldeApres,
            utilisateurId: session.userId,
            reference: `RAP-${reglementId}`
          }
        })

        // On ne met pas à jour le soldeActuel de la banque ici car le règlement (vente/achat) 
        // a déjà dû impacter la trésorerie lors de son enregistrement initial.
        // Le rapprochement est un "pointage" de vérification.
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save Rapprochement Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
