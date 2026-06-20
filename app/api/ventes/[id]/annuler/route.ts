import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'
import { getEntiteId } from '@/lib/get-entite-id'
import { logSuppression, getIpAddress } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'
import { deleteEcrituresByReference, deleteEcrituresByReferenceForIds } from '@/lib/delete-ecritures'
import { pointsFideliteDepuisEncaissement } from '@/lib/calculs-commerciaux'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { archiveVenteSchema } from '@/lib/validations'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (forbidden) return forbidden

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const v = await prisma.vente.findUnique({
      where: { id },
      include: { lignes: true, reglements: true },
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

    const body = await _request.json().catch(() => ({}))
    const vres = validateApiRequest(archiveVenteSchema, body)
    if (!vres.success) return vres.response
    const now = new Date()
    let dateOperation = now
    if (body?.date) {
      const d = new Date(body.date)
      if (!Number.isNaN(d.getTime())) {
        dateOperation = d
        if (String(body.date).length <= 10) {
          dateOperation.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
        }
      }
    }

    return await prisma.$transaction(async (tx) => {
      // VERROU DE CLÔTURE (Au sein de la transaction pour Atomicité + Performance)
      await verifierCloture(v.date, session, tx)

      const totalLivreeVente = v.lignes.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
      const stockPasDeduit = (v.typeVente === 'COMMANDE' && totalLivreeVente === 0) || (v.retraitDiffere && totalLivreeVente === 0)

      if (!stockPasDeduit) {
        for (const l of v.lignes) {
          const qteARembourser = l.quantiteLivree || 0
          if (qteARembourser > 0) {
            await tx.stock.updateMany({
              where: { produitId: l.produitId, magasinId: v.magasinId, entiteId: v.entiteId },
              data: { quantite: { increment: qteARembourser } },
            })
            await tx.mouvement.create({
              data: {
                type: 'ENTREE',
                produitId: l.produitId,
                magasinId: v.magasinId,
                entiteId: v.entiteId,
                utilisateurId: session.userId,
                quantite: qteARembourser,
                observation: `Annulation vente ${v.numero}`,
              },
            })
          }
        }
      }

      await tx.vente.update({ where: { id }, data: { statut: 'ANNULEE' } })

      // 2. Annuler les règlements associés (on ne supprime plus rien pour la traçabilité)
      await tx.reglementVente.updateMany({ 
        where: { venteId: id },
        data: { statut: 'ANNULE' }
      })

      // 3. Compenser les mouvements de trésorerie en fonction des règlements réels
      const reglements = v.reglements || []
      const totalEspeces = reglements.filter((r) => estModeEspeces(r.modePaiement)).reduce((s, r) => s + (r.montant || 0), 0)
        || (estModeEspeces(v.modePaiement) ? (v.montantPaye || 0) : 0)
      const totalBanque = reglements.filter((r) => estModeBanque(r.modePaiement)).reduce((s, r) => s + (r.montant || 0), 0)
        || (estModeBanque(v.modePaiement) ? (v.montantPaye || 0) : 0)

      if (totalEspeces > 0) {
        await enregistrerMouvementCaisse({
          magasinId: v.magasinId,
          type: 'SORTIE',
          motif: `ANNULATION VENTE ${v.numero}`,
          montant: totalEspeces,
          utilisateurId: session.userId,
          entiteId: v.entiteId,
          date: dateOperation,
        }, tx)
        await recalculerSoldeCaisse(v.magasinId, tx)
      }

      if (totalBanque > 0) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: { reference: v.numero }
        })
        for (const op of opsBancaires) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          const banque = await tx.banque.findUnique({ where: { id: op.banqueId } })
          if (banque) {
            const soldeAvant = banque.soldeActuel
            const soldeApres = estEntree ? soldeAvant - op.montant : soldeAvant + op.montant
            await tx.banque.update({
              where: { id: op.banqueId },
              data: { soldeActuel: soldeApres }
            })
            await tx.operationBancaire.create({
              data: {
                banqueId: op.banqueId,
                type: estEntree ? 'REMBOURSEMENT' : 'DEPOT',
                libelle: `ANNULATION VENTE ${v.numero}`,
                montant: op.montant,
                soldeAvant,
                soldeApres,
                utilisateurId: session.userId,
                reference: `ANN-${v.numero}`,
                date: dateOperation,
                observation: `Annulation de la vente ${v.numero} - rollback automatique`,
                entiteId: v.entiteId,
              }
            })
          }
        }
      }

      // 4. Décrémenter les points de fidélité (1 point par 1000 FCFA)
      if (v.clientId && v.montantPaye && v.montantPaye > 0) {
        const pointsADeduire = pointsFideliteDepuisEncaissement(v.montantPaye)
        if (pointsADeduire > 0) {
          await tx.client.update({
            where: { id: v.clientId },
            data: { pointsFidelite: { decrement: pointsADeduire } }
          }).catch(() => {})
        }
      }

      // 5. Supprimer toutes les écritures comptables
      await deleteEcrituresByReference('VENTE', id, tx)
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)
      if (v.reglements.length > 0) {
        await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', v.reglements.map(r => r.id), tx)
      }
      await deleteEcrituresByReference('VENTE_STOCK', id, tx)
      await deleteEcrituresByReference('VENTE_FRAIS', id, tx)
      await deleteEcrituresByReference('COMMANDE_LIVRAISON', id, tx)

      // 6. LOG D'AUDIT
      await logSuppression(
        session,
        'VENTE',
        id,
        `ANNULATION : Facture ${v.numero} annulée, stocks restitués, trésorerie compensée`,
        { numero: v.numero, montantTotal: v.montantTotal, montantPaye: v.montantPaye, modePaiement: v.modePaiement },
        getIpAddress(_request)
      )
      
                  return NextResponse.json({ ok: true })
    })
  } catch (e) {
    await apiCatch(e, 'api/ventes/[id]/annuler')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}