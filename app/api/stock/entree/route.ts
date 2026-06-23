import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logModification, getIpAddress } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { mouvementStockSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'
import { nouveauPampApresAchatLigne } from '@/lib/calculs-commerciaux'
import { comptabiliserMouvementStock } from '@/lib/comptabilisation'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:entree')
  if (forbidden) return forbidden

  try {
    const body = await request.json()

    const validation = validateApiRequest(mouvementStockSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const magasinId = v.magasinId
    const produitId = v.produitId
    const quantite = v.quantite
    const observation = v.observation ?? null
    const prixAchatSaisi = v.prixAchat ?? null
    const dateStr = v.date ?? null
    const dateMouvement = dateStr ? (() => {
      const now = new Date();
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    })() : new Date()
    if (isNaN(dateMouvement.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    const entiteId = await getEntiteId(session)

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    const produit = await prisma.produit.findUnique({ 
      where: { id: produitId },
      include: { stocks: true }
    })
    
    if (!magasin || !produit) {
      return NextResponse.json({ error: 'Magasin ou produit introuvable.' }, { status: 400 })
    }

    let stockAvantRecalcul: { id: number, quantite: number } | null = null

    const updatedStock = await prisma.$transaction(async (tx) => {
      // --- VERROU SÉMANTIQUE (Idempotence temporelle) ---
      // Bloque si une entrée identique a été faite il y a < 15 secondes par le même utilisateur
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await tx.mouvement.findFirst({
        where: {
          type: 'ENTREE',
          produitId,
          magasinId,
          quantite,
          utilisateurId: session.userId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
        throw new Error('DOUBLE_TRANSACTION: Cette entrée de stock semble être un doublon (même produit et quantité en moins de 15s).')
      }

      // Récupérer le point de stock
      let st = await tx.stock.findUnique({
        where: { produitId_magasinId_entiteId: { produitId, magasinId, entiteId } }
      })
      if (!st) {
        st = await tx.stock.create({
          data: { produitId, magasinId, entiteId, quantite: 0, quantiteInitiale: 0 }
        })
      }
      stockAvantRecalcul = { id: st.id, quantite: st.quantite }

      // a. Recalcul PAMP (via fonction centralisée)
      if (prixAchatSaisi !== null) {
        const stockGlobalAvant = produit.stocks.reduce((acc, s) => acc + s.quantite, 0)
        const pampActuel = produit.pamp || produit.prixAchat || 0
        const valeurAchatNet = quantite * prixAchatSaisi
        
        const nouveauPamp = nouveauPampApresAchatLigne({
          stockGlobalAvant,
          pampActuel,
          quantiteLigne: quantite,
          valeurAchatNet,
          prixUnitaireFallback: prixAchatSaisi,
        })
        
        if (nouveauPamp > 0) {
          await tx.produit.update({
            where: { id: produitId },
            data: { pamp: nouveauPamp }
          })
        }
      }

      // b. Création Mouvement
      const mvt = await tx.mouvement.create({
        data: {
          date: dateMouvement,
          type: 'ENTREE',
          produitId,
          magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          quantite,
          observation: observation || 'Entrée stock',
        },
      })

      // c. Mise à jour Stock
      await tx.stock.update({
        where: { id: st.id },
        data: { quantite: { increment: quantite } },
      })

      // d. Comptabilisation
      await comptabiliserMouvementStock({
        produitId,
        magasinId,
        type: 'ENTREE',
        quantite,
        date: dateMouvement,
        motif: observation || 'Entrée stock manuelle',
        utilisateurId: session.userId,
        entiteId: entiteId,
        mouvementId: mvt.id
      }, tx)

      return await tx.stock.findUnique({
        where: { id: stockAvantRecalcul!.id },
        include: { produit: { select: { code: true, designation: true } }, magasin: { select: { code: true } } },
      })
    })

    // Logger l'entrée de stock
    if (updatedStock && stockAvantRecalcul) {
      const { id, quantite: qAvant } = stockAvantRecalcul as { id: number, quantite: number };
      const ipAddress = getIpAddress(request)
      await logModification(
        session,
        'STOCK',
        id,
        `Entrée de stock : ${quantite} unité(s) pour ${updatedStock.produit.designation} dans ${updatedStock.magasin.code}`,
        { quantiteAvant: qAvant },
        { quantiteApres: qAvant + quantite, quantiteAjoutee: quantite },
        ipAddress
      )
    }

    // Invalider le cache pour affichage immédiat
            return NextResponse.json(updatedStock)
  } catch (e: any) {
    await apiCatch(e, 'api/stock/entree')
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cette entrée de stock a déjà été enregistrée (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
