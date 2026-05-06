import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'
import { comptabiliserMouvementStock } from '@/lib/comptabilisation'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { produitId, magasinId, nouvelleQuantite, observation } = await request.json()
    
    if (!produitId || !magasinId || nouvelleQuantite === undefined) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // VERROU DE CLÔTURE (On vérifie la date du jour pour un inventaire)
    await verifierCloture(new Date(), session)

    const entiteId = session.entiteId || 1

    const res = await prisma.$transaction(async (tx) => {
      // 1. Récupérer l'ancien stock
const oldStock = await tx.stock.findUnique({
         where: { produitId_magasinId_entiteId: { produitId, magasinId, entiteId } }
       })
      
      const ancienneQte = oldStock?.quantite || 0
      const difference = nouvelleQuantite - ancienneQte

      if (difference === 0) return oldStock

      // 2. Mettre à jour le stock
const updated = await tx.stock.upsert({
         where: { produitId_magasinId_entiteId: { produitId, magasinId, entiteId } },
        update: { quantite: nouvelleQuantite },
        create: { produitId, magasinId, quantite: nouvelleQuantite, entiteId }
      })

      // 3. Créer un mouvement de régularisation (Ajustement)
      const mouvement = await tx.mouvement.create({
        data: {
          type: difference > 0 ? 'ENTREE' : 'SORTIE',
          produitId,
          magasinId,
          entiteId,
          utilisateurId: session.userId,
          quantite: Math.abs(difference),
          observation: observation || `[INVENTAIRE] Régularisation (${ancienneQte} -> ${nouvelleQuantite})`,
          dateOperation: new Date()
        }
      })

      // 4. Comptabiliser le mouvement de stock (dans la transaction)
      await comptabiliserMouvementStock({
        mouvementId: mouvement.id,
        date: new Date(),
        type: difference > 0 ? 'ENTREE' : 'SORTIE',
        produitId,
        magasinId,
        entiteId,
        quantite: Math.abs(difference),
        utilisateurId: session.userId,
        motif: observation || `Inventaire - ${ancienneQte} -> ${nouvelleQuantite}`,
      }, tx)

      return updated
    })

    return NextResponse.json(res)
  } catch (error) {
    console.error('Erreur Inventaire Rapide:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
