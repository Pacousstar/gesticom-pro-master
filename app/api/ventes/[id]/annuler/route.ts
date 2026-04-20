import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'
import { getEntiteId } from '@/lib/get-entite-id'
import { logSuppression, getIpAddress } from '@/lib/audit'

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

    return await prisma.$transaction(async (tx) => {
      // VERROU DE CLÔTURE (Au sein de la transaction pour Atomicité + Performance)
      await verifierCloture(v.date, session, tx)

      for (const l of v.lignes) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: v.magasinId },
          data: { quantite: { increment: l.quantite } },
        })
        await tx.mouvement.create({
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

      await tx.vente.update({ where: { id }, data: { statut: 'ANNULEE' } })

      // 2. Annuler les règlements associés (on ne supprime plus rien pour la traçabilité)
      await tx.reglementVente.updateMany({ 
        where: { venteId: id },
        data: { statut: 'ANNULE' }
      })

      // 3. Compenser les mouvements de trésorerie par un mouvement inverse
      if (v.montantPaye && v.montantPaye > 0) {
        const { estModeEspeces } = await import('@/lib/caisse')
        const { estModeBanque } = await import('@/lib/banque')

        if (estModeEspeces(v.modePaiement)) {
          // Compensation CAISSE : créer une SORTIE pour annuler l'entrée
          const { enregistrerMouvementCaisse } = await import('@/lib/caisse')
          await enregistrerMouvementCaisse({
            magasinId: v.magasinId,
            type: 'SORTIE',
            motif: `ANNULATION VENTE ${v.numero}`,
            montant: v.montantPaye,
            utilisateurId: session.userId,
            date: new Date()
          }, tx)
        } else if (estModeBanque(v.modePaiement)) {
          // Compensation BANQUE : créer une opération inverse
          const opBancaire = await tx.operationBancaire.findFirst({
            where: { reference: v.numero },
            orderBy: { date: 'desc' }
          })
          if (opBancaire) {
            const banque = await tx.banque.findUnique({ where: { id: opBancaire.banqueId } })
            if (banque) {
              const soldeAvant = banque.soldeActuel
              const soldeApres = soldeAvant - v.montantPaye
              // Rollback balance
              await tx.banque.update({
                where: { id: opBancaire.banqueId },
                data: { soldeActuel: soldeApres }
              })
              // Create reimbursement op
              await tx.operationBancaire.create({
                data: {
                  banqueId: opBancaire.banqueId,
                  type: 'REMBOURSEMENT',
                  libelle: `ANNULATION VENTE ${v.numero}`,
                  montant: v.montantPaye,
                  soldeAvant,
                  soldeApres,
                  utilisateurId: session.userId,
                  reference: `ANN-${v.numero}`,
                  date: new Date(),
                  observation: `Annulation de la vente ${v.numero} - rollback automatique`
                }
              })
            }
          }
        }
      }

      // 4. Décrémenter les points de fidélité
      if (v.clientId && v.montantPaye && v.montantPaye > 0) {
        await tx.client.update({
          where: { id: v.clientId },
          data: { pointsFidelite: { decrement: Math.floor(v.montantPaye) } }
        }).catch(() => {})
      }

      // 5. Supprimer toutes les écritures comptables
      const { deleteEcrituresByReference } = await import('@/lib/delete-ecritures')
      await deleteEcrituresByReference('VENTE', id, tx)
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)
      await deleteEcrituresByReference('VENTE_STOCK', id, tx)
      await deleteEcrituresByReference('VENTE_FRAIS', id, tx)

      // 6. LOG D'AUDIT
      await logSuppression(
        session,
        'VENTE',
        id,
        `ANNULATION : Facture ${v.numero} annulée, stocks restitués, trésorerie compensée`,
        { numero: v.numero, montantTotal: v.montantTotal, montantPaye: v.montantPaye, modePaiement: v.modePaiement },
        getIpAddress(_request)
      )
      
      revalidatePath('/dashboard/ventes')
      revalidatePath('/api/ventes')
      
      return NextResponse.json({ ok: true })
    })
  } catch (e) {
    console.error('POST /api/ventes/[id]/annuler:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
