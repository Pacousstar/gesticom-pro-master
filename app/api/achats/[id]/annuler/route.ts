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
    const a = await prisma.achat.findUnique({
      where: { id },
      include: { lignes: true, reglements: true },
    })
    if (!a) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })
    if (session.role !== 'SUPER_ADMIN') {
      const entiteId = await getEntiteId(session)
      if (a.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
      }
    }
    if (a.statut === 'ANNULEE') {
      return NextResponse.json({ error: 'Cet achat est déjà annulé.' }, { status: 400 })
    }

    const body = await _request.json().catch(() => ({}))
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
      await verifierCloture(a.date, session, tx)

      for (const l of a.lignes) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: a.magasinId, entiteId: a.entiteId },
          data: { quantite: { decrement: l.quantite } },
        })
        await tx.mouvement.create({
          data: {
            type: 'SORTIE',
            produitId: l.produitId,
            magasinId: a.magasinId,
            entiteId: a.entiteId,
            utilisateurId: session.userId,
            quantite: l.quantite,
            observation: `Annulation achat ${a.numero}`,
          },
        })
      }

      const produitIds = [...new Set(a.lignes.map(l => l.produitId))]
      for (const pid of produitIds) {
        const produit = await tx.produit.findUnique({ where: { id: pid } })
        if (produit) {
          const stocks = await tx.stock.findMany({ where: { produitId: pid } })
          const totalQte = stocks.reduce((s: number, st: any) => s + (st.quantite || 0), 0)
          if (totalQte <= 0) {
            const ligne = a.lignes.find(l => l.produitId === pid)
            await tx.produit.update({
              where: { id: pid },
              data: { pamp: ligne?.coutUnitaire || produit.prixAchat || 0 }
            })
          }
        }
      }

      await tx.achat.update({ where: { id }, data: { statut: 'ANNULEE' } })

      await tx.reglementAchat.updateMany({
        where: { achatId: id },
        data: { statut: 'ANNULE' }
      })

      // Détection des mouvements physiques existants (caisse/banque)
      const caisseExistant = await tx.caisse.findMany({
        where: { motif: { contains: `RÈGLEMENT ACHAT ${a.numero}` } }
      })
      const totalEspecesReel = caisseExistant.reduce((s, c) => s + c.montant, 0)

      if (totalEspecesReel > 0) {
        await enregistrerMouvementCaisse({
          magasinId: a.magasinId,
          type: 'ENTREE',
          motif: `ANNULATION ACHAT ${a.numero}`,
          montant: totalEspecesReel,
          utilisateurId: session.userId,
          entiteId: a.entiteId,
          date: dateOperation,
        }, tx)
        await recalculerSoldeCaisse(a.magasinId, tx)
      }

      const opsBancaires = await tx.operationBancaire.findMany({
        where: { reference: a.numero }
      })
      if (opsBancaires.length > 0) {
        for (const op of opsBancaires) {
          const estSortie = ['RETRAIT', 'VIREMENT_SORTANT', 'FRAIS', 'REGLEMENT_FOURNISSEUR', 'ACHAT', 'SORTIE'].includes(op.type.toUpperCase())
          const banque = await tx.banque.findUnique({ where: { id: op.banqueId } })
          if (banque) {
            const soldeAvant = banque.soldeActuel
            const soldeApres = estSortie ? soldeAvant + op.montant : soldeAvant - op.montant
            await tx.banque.update({
              where: { id: op.banqueId },
              data: { soldeActuel: soldeApres }
            })
            await tx.operationBancaire.create({
              data: {
                banqueId: op.banqueId,
                type: estSortie ? 'DEPOT' : 'RETRAIT',
                libelle: `ANNULATION ACHAT ${a.numero}`,
                montant: op.montant,
                soldeAvant,
                soldeApres,
                utilisateurId: session.userId,
                reference: `ANN-A-${a.numero}`,
                date: dateOperation,
                observation: `Annulation de l'achat ${a.numero} - rollback automatique`,
                entiteId: a.entiteId,
              }
            })
          }
        }
      }

      await deleteEcrituresByReference('ACHAT', id, tx)
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)
      if (a.reglements.length > 0) {
        await deleteEcrituresByReferenceForIds('ACHAT_REGLEMENT', a.reglements.map(r => r.id), tx)
      }
      await deleteEcrituresByReference('ACHAT_STOCK', id, tx)

      await logSuppression(
        session,
        'ACHAT',
        id,
        `ANNULATION : Achat ${a.numero} annulé, stocks restitués, trésorerie compensée`,
        { numero: a.numero, montantTotal: a.montantTotal, montantPaye: a.montantPaye, modePaiement: a.modePaiement },
        getIpAddress(_request)
      )

                  return NextResponse.json({ ok: true })
    })
  } catch (e) {
    console.error('POST /api/achats/[id]/annuler:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}