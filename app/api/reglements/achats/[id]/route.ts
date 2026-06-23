import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque, enregistrerOperationBancaire } from '@/lib/banque'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { reglementAchatSchema } from '@/lib/validations'
import { comptabiliserReglementAchat } from '@/lib/comptabilisation'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Action interdite : Les règlements validés ne peuvent être supprimés que par la Direction Générale (Super Administrateur).' },
      { status: 403 }
    )
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)
    const reglement = await prisma.reglementAchat.findUnique({
      where: { id },
      include: { achat: true }
    })

    if (!reglement) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((reglement.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    if (reglement.statut === 'ANNULE') {
      return NextResponse.json({ error: 'Ce règlement est déjà annulé.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)

      if (estModeEspeces(reglement.modePaiement)) {
        const motif = reglement.achat?.numero || `R${reglement.id}`
        await tx.caisse.deleteMany({
          where: { motif: { contains: motif } }
        })
        const magasinId = reglement.achat?.magasinId
        if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
      } else if (estModeBanque(reglement.modePaiement)) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: { reference: reglement.achat?.numero || `REG-A-${id}` }
        })
        for (const op of opsBancaires) {
          const estSortie = ['RETRAIT', 'VIREMENT_SORTANT', 'FRAIS', 'REGLEMENT_FOURNISSEUR', 'ACHAT', 'SORTIE'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estSortie ? { increment: op.montant } : { decrement: op.montant } }
          })
        }
        await tx.operationBancaire.deleteMany({
          where: { reference: reglement.achat?.numero || `REG-A-${id}` }
        })
      }

      if (reglement.achatId) {
        await tx.reglementAchatLigne.deleteMany({
          where: { reglementId: id }
        })

        const a = await tx.achat.findUnique({ where: { id: reglement.achatId } })
        if (a) {
          const remainingLignes = await tx.reglementAchatLigne.findMany({
            where: { achatId: reglement.achatId },
            select: { montant: true }
          })
          const newTotalFromLignes = remainingLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
          const nouveauPaye = Math.max(0, newTotalFromLignes)
          const nouveauStatut = nouveauPaye >= a.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
          await tx.achat.update({
            where: { id: reglement.achatId },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauStatut
            }
          })
        }
      }

      await tx.reglementAchat.update({
        where: { id },
        data: { statut: 'ANNULE' }
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    await apiCatch(e, 'api/reglements/achats/[id]')
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
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)
    const body = await request.json()
    const vres = validateApiRequest(reglementAchatSchema.partial(), body)
    if (!vres.success) return vres.response
    const { montant, modePaiement, date, observation, payeDepuisCaisse, payeDepuisBanque, banqueId } = vres.data

    const old = await prisma.reglementAchat.findUnique({
      where: { id },
      include: { achat: true }
    })
    if (!old) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((old.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // VERROU COMPTABLE : Modification interdite après 24h pour les rôles standards
    const diffHeures = (new Date().getTime() - new Date(old.date).getTime()) / (1000 * 3600)
    if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Verrou Comptable : Ce règlement a été validé il y a plus de 24h. Modification interdite.' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)

      if (estModeEspeces(old.modePaiement)) {
        const motif = old.achat?.numero || `R${id}`
        await tx.caisse.deleteMany({
          where: { motif: { contains: motif } }
        })
        const magasinId = old.achat?.magasinId
        if (magasinId) await recalculerSoldeCaisse(magasinId, tx)
      } else if (estModeBanque(old.modePaiement)) {
        const opsBancaires = await tx.operationBancaire.findMany({
          where: { reference: old.achat?.numero || `REG-A-${id}` }
        })
        for (const op of opsBancaires) {
          const estSortie = ['RETRAIT', 'VIREMENT_SORTANT', 'FRAIS', 'REGLEMENT_FOURNISSEUR', 'ACHAT', 'SORTIE'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estSortie ? { increment: op.montant } : { decrement: op.montant } }
          })
        }
        await tx.operationBancaire.deleteMany({
          where: { reference: old.achat?.numero || `REG-A-${id}` }
        })
      }

      const updated = await tx.reglementAchat.update({
        where: { id },
        data: {
          montant: montant ?? undefined,
          modePaiement: modePaiement ?? undefined,
          date: date ? new Date(date) : undefined,
          observation: observation ?? undefined,
        },
        include: { achat: { include: { fournisseur: { select: { nom: true } } } } }
      })

      if (updated.achatId) {
        const a = await tx.achat.findUnique({ where: { id: updated.achatId } })
        if (a) {
          const [allRegs, allLignes] = await Promise.all([
            tx.reglementAchat.findMany({
              where: { achatId: a.id, statut: 'VALIDE' }
            }),
            tx.reglementAchatLigne.findMany({
              where: { achatId: a.id },
              select: { montant: true }
            })
          ])
          const totalDirectPaye = allRegs.reduce((acc: number, r: any) => acc + r.montant, 0)
          const totalLignePaye = allLignes.reduce((acc: number, l: any) => acc + l.montant, 0)
          const totalPaye = Math.max(totalDirectPaye, totalLignePaye)
          if (totalPaye - a.montantTotal > 1) {
            throw new Error(`Paiement invalide : le total des règlements (${totalPaye.toLocaleString()} F) dépasse le montant de la facture (${a.montantTotal.toLocaleString()} F).`)
          }
          await tx.achat.update({
            where: { id: a.id },
            data: {
              montantPaye: Math.min(a.montantTotal, totalPaye),
              statutPaiement: totalPaye >= a.montantTotal ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })

          const diffMontant = (montant ?? old.montant) - old.montant
          if (diffMontant !== 0 && old.achatId) {
            const existingLigne = await tx.reglementAchatLigne.findFirst({
              where: { reglementId: id, achatId: old.achatId }
            })
            if (existingLigne) {
              await tx.reglementAchatLigne.update({
                where: { id: existingLigne.id },
                data: { montant: montant ?? old.montant }
              })
            }
          }
        }
      }

      if (payeDepuisCaisse && estModeEspeces(updated.modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId: updated.achat?.magasinId || 1,
          type: 'SORTIE',
          motif: `Règlement Achat ${updated.achat?.numero || updated.id}`,
          montant: updated.montant,
          utilisateurId: session.userId,
          entiteId: updated.entiteId ?? entiteId ?? 1,
          date: updated.date,
        }, tx)
        await recalculerSoldeCaisse(updated.achat?.magasinId || 1, tx)
      }
      if (payeDepuisBanque) {
        const banqueIdVal = banqueId ?? null
        await enregistrerOperationBancaire({
          banqueId: banqueIdVal,
          entiteId: updated.entiteId ?? entiteId ?? 1,
          date: updated.date,
          type: 'REGLEMENT_FOURNISSEUR',
          libelle: `Règlement Achat ${updated.achat?.numero || updated.id}`,
          montant: updated.montant,
          utilisateurId: session.userId,
          reference: updated.achat?.numero || `REG-A-${updated.id}`,
          beneficiaire: updated.achat?.fournisseur?.nom || updated.achat?.fournisseurLibre || null,
        }, tx)
      }

      await comptabiliserReglementAchat({
        reglementId: updated.id,
        achatId: updated.achatId ?? 0,
        numeroAchat: updated.achat?.numero || 'SANS_NUMERO',
        date: updated.date,
        montant: updated.montant,
        modePaiement: updated.modePaiement,
        utilisateurId: session.userId,
        entiteId: updated.entiteId ?? undefined,
        paiementDirect: !payeDepuisCaisse && !payeDepuisBanque,
      }, tx)

      return updated
    })

    return NextResponse.json(result)
  } catch (e: any) {
    await apiCatch(e, 'api/reglements/achats/[id]')
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}

