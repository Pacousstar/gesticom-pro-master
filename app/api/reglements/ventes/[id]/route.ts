import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque, enregistrerOperationBancaire } from '@/lib/banque'
import { comptabiliserReglementVente } from '@/lib/comptabilisation'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { reglementVenteSchema } from '@/lib/validations'

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

      // Caisse : chercher par motif standardisé [REGLEMENT:${id}] + fallback ancien format
      if (estModeEspeces(reglement.modePaiement)) {
        const caisses = await tx.caisse.findMany({
          where: {
            OR: [
              { motif: { contains: `REGLEMENT:${id}` } },
              ...(reglement.vente?.numero ? [{ motif: { contains: reglement.vente.numero } }] : []),
            ]
          }
        })
        if (caisses.length > 0) {
          const caisseIds = caisses.map((c: any) => c.id)
          await tx.caisse.deleteMany({ where: { id: { in: caisseIds } } })
          const magasinId = reglement.vente?.magasinId || caisses[0].magasinId
          if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
        }
      } else if (estModeBanque(reglement.modePaiement)) {
        // Banque : chercher par ref standardisée + fallback ancien format
        const opsBancaires = await tx.operationBancaire.findMany({
          where: {
            OR: [
              { reference: `REGLEMENT_${id}` },
              ...(reglement.vente?.numero ? [{ reference: reglement.vente.numero }] : []),
              { reference: `REG-${id}` },
            ]
          }
        })
        for (const op of opsBancaires) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
          })
        }
        if (opsBancaires.length > 0) {
          await tx.operationBancaire.deleteMany({
            where: { id: { in: opsBancaires.map((o: any) => o.id) } }
          })
        }
      }

      // Nettoyer les lignes de lettrage (avec ou sans venteId direct)
      const lignesLettrage = await tx.reglementVenteLigne.findMany({
        where: { reglementId: id },
        select: { venteId: true, montant: true }
      })

      if (lignesLettrage.length > 0) {
        await tx.reglementVenteLigne.deleteMany({ where: { reglementId: id } })

        const venteIds = [...new Set(lignesLettrage.map((l: any) => l.venteId))]
        let clientIdDeduct: number | null = null

        for (const venteId of venteIds) {
          const v = await tx.vente.findUnique({
            where: { id: venteId },
            select: { id: true, montantTotal: true, clientId: true }
          })
          if (!v) continue
          if (v.clientId) clientIdDeduct = v.clientId

          const remainingLignes = await tx.reglementVenteLigne.findMany({
            where: { venteId },
            select: { montant: true }
          })
          const nouveauPaye = remainingLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
          const nouveauStatut = nouveauPaye >= v.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
          await tx.vente.update({
            where: { id: venteId },
            data: { montantPaye: nouveauPaye, statutPaiement: nouveauStatut }
          })
        }

        const totalRegle = lignesLettrage.reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const pts = Math.floor(Math.max(0, totalRegle) / 1000)
        if (pts > 0 && clientIdDeduct) {
          await tx.client.update({
            where: { id: clientIdDeduct },
            data: { pointsFidelite: { decrement: pts } }
          }).catch(() => {})
        }
      } else if (reglement.venteId) {
        // Fallback : reglement avec venteId direct mais sans ligne de lettrage
        const v = await tx.vente.findUnique({ where: { id: reglement.venteId } })
        if (v) {
          const nouveauPaye = Math.max(0, (v.montantPaye || 0) - reglement.montant)
          const nouveauStatut = nouveauPaye >= v.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
          await tx.vente.update({
            where: { id: reglement.venteId },
            data: { montantPaye: nouveauPaye, statutPaiement: nouveauStatut }
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
    await apiCatch(e, 'api/reglements/ventes/[id]')
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
    const vres = validateApiRequest(reglementVenteSchema.partial(), body)
    if (!vres.success) return vres.response
    const { montant, modePaiement, date, observation, banqueId } = vres.data

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
        const caisses = await tx.caisse.findMany({
          where: {
            OR: [
              { motif: { contains: `REGLEMENT:${id}` } },
              ...(old.vente?.numero ? [{ motif: { contains: old.vente.numero } }] : []),
            ]
          }
        })
        if (caisses.length > 0) {
          await tx.caisse.deleteMany({ where: { id: { in: caisses.map((c: any) => c.id) } } })
          const magasinId = old.vente?.magasinId || caisses[0].magasinId
          if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
        }
      } else if (estModeBanque(old.modePaiement)) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: {
            OR: [
              { reference: `REGLEMENT_${id}` },
              ...(old.vente?.numero ? [{ reference: old.vente.numero }] : []),
              { reference: `REG-${id}` },
            ]
          }
        })
        for (const op of opsBancaires) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
          })
        }
        if (opsBancaires.length > 0) {
          await tx.operationBancaire.deleteMany({
            where: { id: { in: opsBancaires.map((o: any) => o.id) } }
          })
        }
      }

      const montantFinal = montant != null ? Math.max(0, montant) : old.montant
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
          motif: `REGLEMENT:${id} Règlement Vente ${updated.vente?.numero || ''}`,
          montant: montantFinal,
          utilisateurId: session.userId,
          entiteId: entiteId || 1,
          date: dateFinal,
        }, tx)
        await recalculerSoldeCaisse(updated.vente?.magasinId || 1, tx)
      } else if (estModeBanque(modeFinal)) {
        const banqueIdVal = banqueId ?? null
        await enregistrerOperationBancaire({
          banqueId: banqueIdVal,
          entiteId: entiteId || 1,
          date: dateFinal,
          type: 'REGLEMENT_CLIENT',
          libelle: `Règlement Vente ${updated.vente?.numero || updated.id}`,
          montant: montantFinal,
          utilisateurId: session.userId,
          reference: `REGLEMENT_${id}`,
          beneficiaire: updated.vente?.client?.nom || updated.vente?.clientLibre || null,
        }, tx)
      }

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
    await apiCatch(e, 'api/reglements/ventes/[id]')
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}