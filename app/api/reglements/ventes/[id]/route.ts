import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Les règlements validés ne peuvent être supprimés que par la Direction Générale (Super Administrateur).' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)
    const reglement = await prisma.reglementVente.findUnique({
      where: { id },
      include: { vente: true }
    })

    if (!reglement) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((reglement.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    if (reglement.statut === 'ANNULE') {
      return NextResponse.json({ error: 'Ce règlement est déjà annulé et ne peut être supprimé.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)

      if (estModeEspeces(reglement.modePaiement)) {
        await tx.caisse.deleteMany({
          where: {
            OR: [
              { motif: `RÈGLEMENT VENTE ${reglement.vente?.numero || ''}` },
              { motif: `RÈGLEMENT : ${reglement.vente?.numero || ''}` },
              { id: reglement.id }
            ].filter(Boolean) as any
          }
        })
        const magasinId = reglement.vente?.magasinId || reglement.vente?.magasinId
        if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
      } else if (estModeBanque(reglement.modePaiement)) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: { reference: reglement.vente?.numero || `REG-${id}` }
        })
        for (const op of opsBancaires) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
          })
        }
        await tx.operationBancaire.deleteMany({
          where: { reference: reglement.vente?.numero || `REG-${id}` }
        })
      }

      if (reglement.venteId) {
        const v = await tx.vente.findUnique({ where: { id: reglement.venteId } })
        if (v) {
          await tx.reglementVenteLigne.deleteMany({
            where: { reglementId: id }
          })

          const remainingLignes = await tx.reglementVenteLigne.findMany({
            where: { venteId: reglement.venteId },
            select: { montant: true }
          })
          const newTotalFromLignes = remainingLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
          const nouveauPaye = Math.max(0, newTotalFromLignes)
          const nouveauStatut = nouveauPaye >= v.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
          await tx.vente.update({
            where: { id: reglement.venteId },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauStatut
            }
          })

          if (v.clientId) {
            const pts = Math.floor(Math.max(0, reglement.montant) / 1000)
            if (pts > 0) {
              await tx.client.update({
                where: { id: v.clientId },
                data: { pointsFidelite: { decrement: pts } }
              }).catch(() => {})
            }
          }
        }
      }

      await tx.reglementVente.update({
        where: { id },
        data: { statut: 'ANNULE' }
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/reglements/ventes/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  try {
    const entiteId = await getEntiteId(session)
    const body = await request.json()
    const { montant, modePaiement, date, observation } = body

    const old = await prisma.reglementVente.findUnique({
      where: { id },
      include: { vente: true }
    })
    if (!old) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((old.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    if (old.statut === 'ANNULE') {
      return NextResponse.json({ error: 'Ce règlement est annulé et ne peut être modifié.' }, { status: 400 })
    }

    const diffHeures = (new Date().getTime() - new Date(old.date).getTime()) / (1000 * 3600)
    if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Verrou Comptable : Ce règlement a été validé il y a plus de 24h. Modification interdite.' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)

      if (estModeEspeces(old.modePaiement)) {
        await tx.caisse.deleteMany({
          where: {
            OR: [
              { motif: `RÈGLEMENT VENTE ${old.vente?.numero || ''}` },
              { motif: `RÈGLEMENT : ${old.vente?.numero || ''}` },
            ].filter(Boolean)
          }
        })
        const magasinId = old.vente?.magasinId
        if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
      } else if (estModeBanque(old.modePaiement)) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: { reference: old.vente?.numero || `REG-${id}` }
        })
        for (const op of opsBancaires) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
          })
        }
        await tx.operationBancaire.deleteMany({
          where: { reference: old.vente?.numero || `REG-${id}` }
        })
      }

      const montantFinal = montant != null ? Math.max(0, Number(montant)) : old.montant
      const modeFinal = modePaiement || old.modePaiement
      let dateFinal = old.date
      if (date) {
        const newDate = new Date(date)
        if (date.length <= 10) {
          newDate.setHours(old.date.getHours(), old.date.getMinutes(), old.date.getSeconds())
        }
        dateFinal = newDate
      }

      const updated = await tx.reglementVente.update({
        where: { id },
        data: {
          montant: montantFinal,
          modePaiement: modeFinal,
          date: dateFinal,
          observation: observation !== undefined ? (observation || null) : old.observation
        },
include: { vente: { include: { client: { select: { nom: true } } } } }
      })

      if (updated.venteId) {
        const v = await tx.vente.findUnique({ where: { id: updated.venteId } })
        if (v) {
          const [allRegs, allLignes] = await Promise.all([
            tx.reglementVente.findMany({
              where: { venteId: v.id, statut: 'VALIDE' }
            }),
            tx.reglementVenteLigne.findMany({
              where: { venteId: v.id },
              select: { montant: true }
            })
          ])
          const totalDirectPaye = allRegs.reduce((acc, r) => acc + r.montant, 0)
          const totalLignePaye = allLignes.reduce((acc, l) => acc + l.montant, 0)
          const totalPaye = Math.max(totalDirectPaye, totalLignePaye)
          if (totalPaye - v.montantTotal > 1) {
            throw new Error(`Paiement invalide : le total des règlements (${totalPaye.toLocaleString()} F) dépasse le montant de la facture (${v.montantTotal.toLocaleString()} F).`)
          }
          const nouveauPaye = Math.min(v.montantTotal, totalPaye)
          await tx.vente.update({
            where: { id: v.id },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauPaye >= v.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })

          const diffMontant = montantFinal - old.montant
          if (diffMontant !== 0 && old.venteId) {
            const existingLigne = await tx.reglementVenteLigne.findFirst({
              where: { reglementId: id, venteId: old.venteId }
            })
            if (existingLigne) {
              await tx.reglementVenteLigne.update({
                where: { id: existingLigne.id },
                data: { montant: montantFinal }
              })
            }
          }
        }
      }

      if (estModeEspeces(modeFinal)) {
        await enregistrerMouvementCaisse({
          magasinId: updated.vente?.magasinId || 1,
          type: 'ENTREE',
          motif: `Règlement Vente ${updated.vente?.numero || updated.id}`,
          montant: montantFinal,
          utilisateurId: session.userId,
          entiteId: entiteId || 1,
          date: dateFinal,
        }, tx)
        await recalculerSoldeCaisse(updated.vente?.magasinId || 1, tx)
      } else if (estModeBanque(modeFinal)) {
        const banqueId = body?.banqueId ? Number(body.banqueId) : null
        const { enregistrerOperationBancaire } = await import('@/lib/banque')
        await enregistrerOperationBancaire({
          banqueId,
          entiteId: entiteId || 1,
          date: dateFinal,
          type: 'REGLEMENT_CLIENT',
          libelle: `Règlement Vente ${updated.vente?.numero || updated.id}`,
          montant: montantFinal,
          utilisateurId: session.userId,
          reference: updated.vente?.numero || `REG-${updated.id}`,
          beneficiaire: updated.vente?.client?.nom || updated.vente?.clientLibre || null,
        }, tx)
      }

      const { comptabiliserReglementVente } = await import('@/lib/comptabilisation')
      await comptabiliserReglementVente({
        venteId: updated.venteId ?? 0,
        numeroVente: updated.vente?.numero || 'SANS_NUMERO',
        date: dateFinal,
        montant: montantFinal,
        modePaiement: modeFinal,
        utilisateurId: session.userId,
        entiteId: entiteId || 1,
        magasinId: updated.vente?.magasinId,
        reglementId: updated.id,
      }, tx)

      return updated
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('PATCH /api/reglements/ventes/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}