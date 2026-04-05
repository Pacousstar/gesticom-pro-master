import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logModification, getIpAddress } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

/**
 * Sortie de stock (hors vente) : casse, don, transfert, correction, etc.
 * Crée un Mouvement type SORTIE et décrémente le stock.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:sortie')
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
    const entiteId = await getEntiteId(session)

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    const produit = await prisma.produit.findUnique({ where: { id: produitId } })
    if (!magasin || !produit) {
      return NextResponse.json({ error: 'Magasin ou produit introuvable.' }, { status: 400 })
    }

    // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
    if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
    }

    let st = await prisma.stock.findUnique({
      where: { produitId_magasinId: { produitId, magasinId } },
    })
    // Si le produit n'existe pas dans ce magasin, créer la ligne de stock
    if (!st) {
      st = await prisma.stock.create({
        data: {
          produitId,
          magasinId,
          quantite: 0,
          quantiteInitiale: 0,
        },
      })
    }
    if (st.quantite < quantite) {
      return NextResponse.json(
        { error: `Stock insuffisant. Disponible : ${st.quantite}, demandé : ${quantite}.` },
        { status: 400 }
      )
    }

    await prisma.mouvement.create({
      data: {
        date: dateMouvement,
        type: 'SORTIE',
        produitId,
        magasinId,
        entiteId: entiteId,
        utilisateurId: session.userId,
        quantite,
        observation: observation || 'Sortie stock',
      },
    })

    await prisma.stock.update({
      where: { id: st.id },
      data: { quantite: { decrement: quantite } },
    })

    // Comptabilisation de la sortie de stock
    try {
      const { comptabiliserMouvementStock } = await import('@/lib/comptabilisation')
      await comptabiliserMouvementStock({
        produitId,
        magasinId,
        type: 'SORTIE',
        quantite,
        date: dateMouvement,
        motif: observation || 'Sortie stock manuelle',
        utilisateurId: session.userId,
        entiteId: entiteId
      })
    } catch (comptaError) {
      console.error('Erreur comptabilisation sortie stock:', comptaError)
    }

    const updated = await prisma.stock.findUnique({
      where: { id: st.id },
      include: { produit: { select: { code: true, designation: true } }, magasin: { select: { code: true } } },
    })

    // ✅ LOG AUDIT : Tracer la sortie de stock pour éviter les "fuites" d'employés
    const ipAddress = getIpAddress(request)
    await logModification(
      session,
      'STOCK',
      st.id,
      `Sortie manuelle de stock : ${quantite} unité(s) pour ${updated?.produit.designation} depuis ${updated?.magasin.code}. Motif: ${observation || 'Sortie stock'}`,
      { quantiteAvant: st.quantite },
      { quantiteApres: st.quantite - quantite, quantiteSortie: quantite },
      ipAddress
    )

    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/stock')

    return NextResponse.json(updated)
  } catch (e) {
    console.error('POST /api/stock/sortie:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
