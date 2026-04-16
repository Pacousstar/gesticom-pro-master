import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

/**
 * Régularisation du stock après inventaire : pour chaque ligne (stockId, quantiteReelle),
 * crée un Mouvement ENTREE ou SORTIE pour aligner le stock sur la quantité réelle.
 * OPTIMISÉ : Utilise des transactions et des opérations en batch pour améliorer les performances.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const lignes = Array.isArray(body?.lignes) ? body.lignes : []
    const dateStr = body?.date != null ? String(body.date).trim() : null
    const dateInventaire = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
    if (isNaN(dateInventaire.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)

    // Préparer les données : récupérer tous les stocks en une seule requête
    const stockIds = lignes
      .map((l: any) => Number(l?.stockId))
      .filter((id: number) => Number.isInteger(id) && id > 0)

    if (stockIds.length === 0) {
      return NextResponse.json({ regularise: 0 })
    }

    // Récupérer tous les stocks en une seule requête
    const stocks = await prisma.stock.findMany({
      where: { id: { in: stockIds } },
      select: {
        id: true,
        produitId: true,
        magasinId: true,
        quantite: true,
      },
    })

    const stocksMap = new Map(stocks.map((s) => [s.id, s]))

    // Préparer les opérations en batch
    const mouvements: Array<{
      date: Date
      type: 'ENTREE' | 'SORTIE'
      produitId: number
      magasinId: number
      entiteId: number
      utilisateurId: number
      quantite: number
      observation: string
    }> = []

    const updatesStock: Array<{ id: number; quantite: number }> = []

    const observation = `Inventaire ${dateInventaire.toISOString().slice(0, 10)} – régularisation`

    // Traiter toutes les lignes
    for (const l of lignes) {
      const stockId = Number(l?.stockId)
      const quantiteReelle = Math.max(0, Number(l?.quantiteReelle) || 0) // Libération des décimales
      if (!Number.isInteger(stockId) || stockId < 1) continue

      const st = stocksMap.get(stockId)
      if (!st) continue

      const ecart = quantiteReelle - st.quantite
      if (ecart === 0) continue

      if (ecart > 0) {
        mouvements.push({
          date: dateInventaire,
          type: 'ENTREE',
          produitId: st.produitId,
          magasinId: st.magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          quantite: ecart,
          observation,
        })
        updatesStock.push({ id: st.id, quantite: quantiteReelle })
      } else {
        mouvements.push({
          date: dateInventaire,
          type: 'SORTIE',
          produitId: st.produitId,
          magasinId: st.magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          quantite: -ecart,
          observation,
        })
        updatesStock.push({ id: st.id, quantite: quantiteReelle })
      }
    }

    // Exécuter toutes les opérations dans une transaction
    let regularise = 0
    if (mouvements.length > 0) {
      // --- VERROU SÉMANTIQUE (Idempotence temporelle) ---
      // Bloque si un inventaire a été validé il y a < 15 secondes par le même utilisateur pour ce magasin
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await prisma.mouvement.findFirst({
        where: {
          observation: { contains: 'Inventaire' },
          utilisateurId: session.userId,
          entiteId: entiteId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
         return NextResponse.json({ 
           error: 'Cet inventaire semble déjà avoir été validé (Doublon bloqué).', 
           code: 'IDEMPOTENCY_CONFLICT' 
         }, { status: 409 })
      }

      await prisma.$transaction(async (tx) => {
        // Créer tous les mouvements en batch et les comptabiliser
        const { comptabiliserMouvementStock } = await import('@/lib/comptabilisation')
        for (const mvtData of mouvements) {
          const mvt = await tx.mouvement.create({ data: mvtData })
          await comptabiliserMouvementStock({
            produitId: mvt.produitId,
            magasinId: mvt.magasinId,
            type: mvt.type as 'ENTREE' | 'SORTIE',
            quantite: mvt.quantite,
            date: mvt.date,
            motif: mvt.observation || 'Régularisation inventaire',
            utilisateurId: mvt.utilisateurId,
            entiteId: mvt.entiteId,
            mouvementId: mvt.id
          }, tx)
        }

        // Mettre à jour tous les stocks en batch
        for (const update of updatesStock) {
          await tx.stock.update({
            where: { id: update.id },
            data: { quantite: update.quantite },
          })
        }

        regularise = mouvements.length
      })
    }

    return NextResponse.json({ regularise })
  } catch (e) {
    console.error('POST /api/stock/inventaire:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
