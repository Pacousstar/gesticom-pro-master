import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { stockInventaireSchema } from '@/lib/validations'

/**
 * Régularisation du stock après inventaire : pour chaque ligne (produitId, quantitePhysique),
 * crée un Mouvement ENTREE ou SORTIE pour aligner le stock sur la quantité réelle.
 * OPTIMISÉ : Utilise des transactions et des opérations en batch pour améliorer les performances.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'stocks:view')
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateApiRequest(stockInventaireSchema, body)
    if (!result.success) return result.response
    const data = result.data

    const dateStr = data.date?.trim() ?? null
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

    // Récupérer tous les stocks par produitId+magasinId
    const produitIds = data.lignes.map(l => l.produitId)
    const stocks = await prisma.stock.findMany({
      where: { produitId: { in: produitIds }, magasinId: data.magasinId },
      select: {
        id: true,
        produitId: true,
        magasinId: true,
        quantite: true,
      },
    })

    const stocksMap = new Map(stocks.map((s) => [`${s.produitId}:${s.magasinId}`, s]))

    if (stocksMap.size === 0 && data.lignes.length > 0) {
      return NextResponse.json({ regularise: 0 })
    }

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

    const observation = data.observation ?? `Inventaire ${dateInventaire.toISOString().slice(0, 10)} – régularisation`

    // Traiter toutes les lignes
    for (const l of data.lignes) {
      const key = `${l.produitId}:${data.magasinId}`
      const st = stocksMap.get(key)
      if (!st) continue

      const ecart = l.quantitePhysique - st.quantite
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
        updatesStock.push({ id: st.id, quantite: l.quantitePhysique })
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
        updatesStock.push({ id: st.id, quantite: l.quantitePhysique })
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
    await apiCatch(e, 'api/stock/inventaire')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
