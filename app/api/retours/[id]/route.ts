import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logSuppression, getIpAddress } from '@/lib/audit'
import { recalculerSoldeCaisse } from '@/lib/caisse'
import { verifierCloture } from '@/lib/cloture'
import { requireRole } from '@/lib/require-role'
import { ROLES_ADMIN } from '@/lib/roles-permissions'
import { apiCatch } from '@/lib/log-error'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const authError = requireRole(session, ROLES_ADMIN)
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const retour = await prisma.retour.findUnique({
      where: { id },
      include: { lignes: true },
    })
    if (!retour) throw new Error('Retour introuvable.')

    await prisma.$transaction(async (tx) => {
      await verifierCloture(retour.createdAt, session, tx)

      const vente = await tx.vente.findUnique({ where: { id: retour.venteId }, select: { numero: true } })

      // 1. Inverser l'effet stock (retour avait incrémenté le stock)
      for (const l of retour.lignes) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: retour.magasinId, entiteId: retour.entiteId },
          data: { quantite: { decrement: l.quantite } },
        })
      }

      // 2. Nettoyer les mouvements de stock
      await tx.mouvement.deleteMany({
        where: { observation: `Retour client - Vente ${vente?.numero || retour.venteId}` },
      })

      // 3. Nettoyer les écritures de caisse
      const caisses = await tx.caisse.findMany({
        where: { motif: { contains: retour.numero } },
        select: { id: true },
      })
      const caisseIds = caisses.map((c: any) => c.id)
      if (caisseIds.length > 0) {
        await tx.ecritureComptable.deleteMany({ where: { referenceType: 'CAISSE', referenceId: { in: caisseIds } } })
        await tx.caisse.deleteMany({ where: { id: { in: caisseIds } } })
      }

      // 4. Nettoyer les opérations bancaires
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { reference: retour.numero },
        select: { id: true, banqueId: true, montant: true, type: true },
      })
      for (const op of opsBancaires) {
        const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } },
        })
      }
      const banqueOpIds = opsBancaires.map((op: any) => op.id)
      if (banqueOpIds.length > 0) {
        await tx.ecritureComptable.deleteMany({ where: { referenceType: 'BANQUE', referenceId: { in: banqueOpIds } } })
        await tx.operationBancaire.deleteMany({ where: { id: { in: banqueOpIds } } })
      }

      // 5. Restaurer le montant payé de la vente (le retour avait réduit montantPaye)
      if (vente) {
        const venteFull = await tx.vente.findUnique({
          where: { id: retour.venteId },
          select: { montantTotal: true }
        })
        if (venteFull) {
          const lignesReglement = await tx.reglementVenteLigne.findMany({
            where: { venteId: retour.venteId },
            select: { montant: true }
          })
          const totalPaye = lignesReglement.reduce((s: number, l: any) => s + (l.montant || 0), 0)
          const nouveauMontantPaye = Math.min(venteFull.montantTotal, totalPaye)
          await tx.vente.update({
            where: { id: retour.venteId },
            data: {
              montantPaye: nouveauMontantPaye,
              statutPaiement: nouveauMontantPaye >= venteFull.montantTotal ? 'PAYE' : nouveauMontantPaye > 0 ? 'PARTIEL' : 'CREDIT',
            }
          })
        }
      }

      // 6. Supprimer les lignes et le retour
      await tx.retourLigne.deleteMany({ where: { retourId: id } })
      await tx.retour.delete({ where: { id } })

      // 6. Recalculer le solde caisse
      await recalculerSoldeCaisse(retour.magasinId, tx)
    }, { timeout: 30000 })

    // 7. LOG D'AUDIT (hors transaction)
    await logSuppression(session, 'RETOUR', id, `Suppression retour ${retour.numero}`, { numero: retour.numero, montant: retour.montantTotal }, getIpAddress(_request))

            return NextResponse.json({ success: true })
  } catch (e) {
    await apiCatch(e, 'api/retours/[id]')
    return NextResponse.json({ error: (e as Error).message || 'Erreur serveur.' }, { status: 500 })
  }
}
