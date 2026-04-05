import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const v = await prisma.vente.findUnique({
      where: { id },
      include: { lignes: true },
    })
    if (!v) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
    if (session.role !== 'SUPER_ADMIN') {
      const entiteId = await getEntiteId(session)
      if (v.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
      }
    }
    if (v.statut === 'ANNULEE') {
      return NextResponse.json({ error: 'Cette vente est déjà annulée.' }, { status: 400 })
    }

    for (const l of v.lignes) {
      await prisma.stock.updateMany({
        where: { produitId: l.produitId, magasinId: v.magasinId },
        data: { quantite: { increment: l.quantite } },
      })
      await prisma.mouvement.create({
        data: {
          type: 'ENTREE',
          produitId: l.produitId,
          magasinId: v.magasinId,
          entiteId: v.entiteId,
          utilisateurId: session.userId,
          quantite: l.quantite,
          observation: `Annulation vente ${v.numero}`,
        },
      })
    }

    await prisma.vente.update({ where: { id }, data: { statut: 'ANNULEE' } })

    // 2. Annuler les règlements associés (on ne supprime plus rien pour la traçabilité)
    await prisma.reglementVente.updateMany({ 
      where: { venteId: id },
      data: { statut: 'ANNULE' }
    })

    // 3. Compenser les mouvements de caisse par un mouvement inverse (SORTIE)
    if (v.montantPaye && v.montantPaye > 0) {
      const { enregistrerMouvementCaisse, estModeEspeces } = await import('@/lib/caisse')
      if (estModeEspeces(v.modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId: v.magasinId,
          type: 'SORTIE',
          motif: `ANNULATION VENTE ${v.numero}`,
          montant: v.montantPaye,
          utilisateurId: session.userId,
          date: new Date()
        })
      }
    }

    // 4. Décrémenter les points de fidélité si client identifié
    if (v.clientId && v.montantPaye && v.montantPaye > 0) {
      await prisma.client.update({
        where: { id: v.clientId },
        data: { pointsFidelite: { decrement: Math.floor(v.montantPaye) } }
      }).catch(() => {})
    }

    // 5. Supprimer les écritures comptables (la compta doit rester propre, mais on pourrait aussi faire des écritures inverses)
    const { deleteEcrituresByReference } = await import('@/lib/delete-ecritures')
    await deleteEcrituresByReference('VENTE', id)
    
    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/ventes')
    revalidatePath('/api/ventes')
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/ventes/[id]/annuler:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
