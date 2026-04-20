import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'

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

    const res = await prisma.$transaction(async (tx) => {
      // 1. Récupérer l'ancien stock
      const oldStock = await tx.stock.findUnique({
        where: { produitId_magasinId: { produitId, magasinId } }
      })
      
      const ancienneQte = oldStock?.quantite || 0
      const difference = nouvelleQuantite - ancienneQte

      if (difference === 0) return oldStock

      // 2. Mettre à jour le stock
      const updated = await tx.stock.upsert({
        where: { produitId_magasinId: { produitId, magasinId } },
        update: { quantite: nouvelleQuantite },
        create: { produitId, magasinId, quantite: nouvelleQuantite, entiteId: session.entiteId || 1 }
      })

      // 3. Créer un mouvement de régularisation (Ajustement)
      await tx.mouvement.create({
        data: {
          type: difference > 0 ? 'ENTREE' : 'SORTIE',
          produitId,
          magasinId,
          entiteId: session.entiteId || 1,
          utilisateurId: session.userId,
          quantite: Math.abs(difference),
          observation: observation || `[INVENTAIRE] Régularisation (${ancienneQte} -> ${nouvelleQuantite})`,
          dateOperation: new Date()
        }
      })

      return updated
    })

    return NextResponse.json(res)
  } catch (error) {
    console.error('Erreur Inventaire Rapide:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
