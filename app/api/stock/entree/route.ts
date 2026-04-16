import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logModification, getIpAddress, getUserAgent } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:entree')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const magasinId = Number(body?.magasinId)
    const produitId = Number(body?.produitId)
    const quantite = Math.max(0, Number(body?.quantite) || 0) // Libération des décimales
    const observation = body?.observation != null ? String(body.observation).trim() || null : null
    const dateStr = body?.date != null ? String(body.date).trim() : null
    const dateMouvement = dateStr ? (() => {
      const now = new Date();
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    })() : new Date()
    if (isNaN(dateMouvement.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    if (!Number.isInteger(magasinId) || magasinId < 1 || !Number.isInteger(produitId) || produitId < 1) {
      return NextResponse.json({ error: 'Magasin et produit requis.' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const prixAchatSaisi = body?.prixAchat != null ? Math.max(0, Number(body.prixAchat) || 0) : null

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
        where: { produitId_magasinId: { produitId, magasinId } }
      })
      if (!st) {
        st = await tx.stock.create({
          data: { produitId, magasinId, entiteId, quantite: 0, quantiteInitiale: 0 }
        })
      }
      stockAvantRecalcul = { id: st.id, quantite: st.quantite }

      // a. Recalcul PAMP
      if (prixAchatSaisi !== null) {
        const stockGlobalAvant = produit.stocks.reduce((acc, s) => acc + s.quantite, 0)
        const pampActuel = produit.pamp || produit.prixAchat || 0
        
        let nouveauPamp = pampActuel
        if (stockGlobalAvant <= 0) {
          nouveauPamp = prixAchatSaisi
        } else {
          const valeurExistante = stockGlobalAvant * pampActuel
          const valeurNouvelle = quantite * prixAchatSaisi
          nouveauPamp = (valeurExistante + valeurNouvelle) / (stockGlobalAvant + quantite)
        }
        
        if (!isNaN(nouveauPamp) && isFinite(nouveauPamp)) {
          await tx.produit.update({
            where: { id: produitId },
            data: { pamp: Math.round(nouveauPamp) }
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
      const { comptabiliserMouvementStock } = await import('@/lib/comptabilisation')
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
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/stock')

    return NextResponse.json(updatedStock)
  } catch (e: any) {
    console.error('POST /api/stock/entree:', e)
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cette entrée de stock a déjà été enregistrée (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
