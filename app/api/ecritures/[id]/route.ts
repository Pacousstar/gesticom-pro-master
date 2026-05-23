import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { verifierCloture } from '@/lib/cloture'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import {
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserDepense,
  comptabiliserCharge,
  comptabiliserReglementVente,
  comptabiliserReglementAchat,
} from '@/lib/comptabilisation'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const where: any = { id }
  if (session.role !== 'SUPER_ADMIN') {
    const eId = await getEntiteId(session)
    if (eId > 0) where.entiteId = eId
  }

  const ecriture = await prisma.ecritureComptable.findFirst({
    where,
    include: {
      journal: { select: { code: true, libelle: true } },
      compte: { select: { numero: true, libelle: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  if (!ecriture) return NextResponse.json({ error: 'Écriture introuvable.' }, { status: 404 })
  return NextResponse.json(ecriture)
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
    const body = await request.json()
    const updateData: {
      date?: Date
      journalId?: number
      piece?: string | null
      libelle?: string
      compteId?: number
      debit?: number
      credit?: number
      reference?: string | null
      referenceType?: string | null
      referenceId?: number | null
    } = {}

    if (body.date) updateData.date = new Date(body.date)
    if (body.journalId != null) {
      const jId = Number(body.journalId)
      if (Number.isInteger(jId) && jId > 0) {
        const journal = await prisma.journal.findUnique({ where: { id: jId } })
        if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 400 })
        updateData.journalId = jId
      }
    }
    if (body.piece !== undefined) updateData.piece = body.piece ? String(body.piece).trim() || null : null
    if (body.libelle != null) updateData.libelle = String(body.libelle).trim()
    if (body.compteId != null) {
      const cId = Number(body.compteId)
      if (Number.isInteger(cId) && cId > 0) {
        const compte = await prisma.planCompte.findUnique({ where: { id: cId } })
        if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 })
        updateData.compteId = cId
      }
    }
    if (body.debit != null) updateData.debit = Math.max(0, Number(body.debit))
    if (body.credit != null) updateData.credit = Math.max(0, Number(body.credit))

    // Validation : débit ou crédit doit être > 0, pas les deux
    if (updateData.debit !== undefined && updateData.credit !== undefined) {
      if (updateData.debit === 0 && updateData.credit === 0) {
        return NextResponse.json({ error: 'Débit ou crédit doit être supérieur à 0.' }, { status: 400 })
      }
      if (updateData.debit > 0 && updateData.credit > 0) {
        return NextResponse.json({ error: 'Une écriture ne peut avoir à la fois un débit et un crédit.' }, { status: 400 })
      }
    }

    if (body.reference !== undefined) updateData.reference = body.reference ? String(body.reference).trim() || null : null
    if (body.referenceType !== undefined) updateData.referenceType = body.referenceType ? String(body.referenceType).trim() || null : null
    if (body.referenceId !== undefined) updateData.referenceId = body.referenceId != null ? Number(body.referenceId) : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    // Vérification de l'existence et du droit d'accès
    const checkWhere: any = { id }
    if (session.role !== 'SUPER_ADMIN') {
      const eId = await getEntiteId(session)
      if (eId > 0) checkWhere.entiteId = eId
    }
    const existing = await prisma.ecritureComptable.findFirst({ where: checkWhere })
    if (!existing) return NextResponse.json({ error: 'Écriture introuvable ou non autorisée.' }, { status: 404 })

    // RE1: Vérification cloture sur la date actuelle
    await verifierCloture(existing.date, session)

    // RE2: Re-comptabiliser si écriture liée à une opération source
    if (existing.referenceType && existing.referenceId) {
      const refType = existing.referenceType
      const refId = existing.referenceId

      // Supprimer toutes les écritures liées à cette référence
      await deleteEcrituresByReference(refType, refId)

      // Re-générer les écritures selon le type de référence
      if (refType === 'VENTE' || refType === 'VENTE_REGLEMENT') {
        const vente = await prisma.vente.findUnique({
          where: { id: refId },
          select: { numero: true, date: true, montantTotal: true, modePaiement: true, clientId: true, utilisateurId: true, entiteId: true, magasinId: true },
        })
        if (vente) {
          if (refType === 'VENTE') {
            await comptabiliserVente({
              venteId: refId,
              numeroVente: vente.numero,
              date: vente.date,
              montantTotal: Number(vente.montantTotal),
              modePaiement: vente.modePaiement || 'ESPECES',
              clientId: vente.clientId ?? undefined,
              utilisateurId: vente.utilisateurId,
              entiteId: vente.entiteId,
              magasinId: vente.magasinId,
            })
          } else {
            await comptabiliserReglementVente({
              venteId: refId,
              numeroVente: vente.numero,
              date: existing.date,
              montant: Number(existing.debit || existing.credit),
              modePaiement: vente.modePaiement || 'ESPECES',
              utilisateurId: existing.utilisateurId,
              entiteId: vente.entiteId,
            })
          }
        }
      } else if (refType === 'ACHAT' || refType === 'ACHAT_REGLEMENT') {
        const achat = await prisma.achat.findUnique({
          where: { id: refId },
          select: { numero: true, date: true, montantTotal: true, modePaiement: true, fournisseurId: true, utilisateurId: true, entiteId: true, magasinId: true },
        })
        if (achat) {
          if (refType === 'ACHAT') {
            await comptabiliserAchat({
              achatId: refId,
              numeroAchat: achat.numero,
              date: achat.date,
              montantTotal: Number(achat.montantTotal),
              modePaiement: achat.modePaiement || 'ESPECES',
              fournisseurId: achat.fournisseurId ?? undefined,
              utilisateurId: achat.utilisateurId,
              entiteId: achat.entiteId,
              magasinId: achat.magasinId,
            })
          } else {
            await comptabiliserReglementAchat({
              achatId: refId,
              numeroAchat: achat.numero,
              date: existing.date,
              montant: Number(existing.debit || existing.credit),
              modePaiement: achat.modePaiement || 'ESPECES',
              utilisateurId: existing.utilisateurId,
              entiteId: achat.entiteId,
            })
          }
        }
      } else if (refType === 'DEPENSE') {
        const depense = await prisma.depense.findUnique({
          where: { id: refId },
          select: { date: true, montant: true, montantPaye: true, categorie: true, libelle: true, modePaiement: true, utilisateurId: true, entiteId: true },
        })
        if (depense) {
          await comptabiliserDepense({
            depenseId: refId,
            date: depense.date,
            montantTotal: Number(depense.montant),
            montantPaye: Number(depense.montantPaye || depense.montant),
            categorie: depense.categorie,
            libelle: depense.libelle,
            modePaiement: depense.modePaiement || 'ESPECES',
            utilisateurId: depense.utilisateurId,
            entiteId: depense.entiteId,
          })
        }
      } else if (refType === 'CHARGE') {
        const charge = await prisma.charge.findUnique({
          where: { id: refId },
          select: { date: true, montant: true, rubrique: true, observation: true, utilisateurId: true, entiteId: true, magasinId: true, modePaiement: true },
        })
        if (charge) {
          await comptabiliserCharge({
            chargeId: refId,
            date: charge.date,
            montant: Number(charge.montant),
            rubrique: charge.rubrique,
            libelle: charge.observation ?? undefined,
            utilisateurId: charge.utilisateurId,
            entiteId: charge.entiteId,
            magasinId: charge.magasinId,
            modePaiement: charge.modePaiement,
          })
        }
      }
    }

    const ecriture = await prisma.ecritureComptable.update({
      where: { id },
      data: updateData,
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(ecriture)
  } catch (e) {
    console.error('PATCH /api/ecritures/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
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
    // Vérification de l'existence et du droit d'accès
    const checkWhere: any = { id }
    if (session.role !== 'SUPER_ADMIN') {
      const eId = await getEntiteId(session)
      if (eId > 0) checkWhere.entiteId = eId
    }
    const existing = await prisma.ecritureComptable.findFirst({ where: checkWhere })
    if (!existing) return NextResponse.json({ error: 'Écriture introuvable ou non autorisée.' }, { status: 404 })

    // RE3: Vérification cloture
    await verifierCloture(existing.date, session)

    // RE4: Re-comptabiliser si écriture liée à une opération source
    const refType = existing.referenceType
    const refId = existing.referenceId
    if (refType && refId) {
      await deleteEcrituresByReference(refType, refId)

      if (refType === 'VENTE') {
        const vente = await prisma.vente.findUnique({ where: { id: refId }, select: { numero: true, date: true, montantTotal: true, modePaiement: true, clientId: true, utilisateurId: true, entiteId: true, magasinId: true } })
        if (vente) {
          await comptabiliserVente({ venteId: refId, numeroVente: vente.numero, date: vente.date, montantTotal: Number(vente.montantTotal), modePaiement: vente.modePaiement || 'ESPECES', clientId: vente.clientId ?? undefined, utilisateurId: vente.utilisateurId, entiteId: vente.entiteId, magasinId: vente.magasinId })
        }
      } else if (refType === 'ACHAT') {
        const achat = await prisma.achat.findUnique({ where: { id: refId }, select: { numero: true, date: true, montantTotal: true, modePaiement: true, fournisseurId: true, utilisateurId: true, entiteId: true, magasinId: true } })
        if (achat) {
          await comptabiliserAchat({ achatId: refId, numeroAchat: achat.numero, date: achat.date, montantTotal: Number(achat.montantTotal), modePaiement: achat.modePaiement || 'ESPECES', fournisseurId: achat.fournisseurId ?? undefined, utilisateurId: achat.utilisateurId, entiteId: achat.entiteId, magasinId: achat.magasinId })
        }
      } else if (refType === 'DEPENSE') {
        const depense = await prisma.depense.findUnique({ where: { id: refId }, select: { date: true, montant: true, montantPaye: true, categorie: true, libelle: true, modePaiement: true, utilisateurId: true, entiteId: true } })
        if (depense) {
          await comptabiliserDepense({ depenseId: refId, date: depense.date, montantTotal: Number(depense.montant), montantPaye: Number(depense.montantPaye || depense.montant), categorie: depense.categorie, libelle: depense.libelle, modePaiement: depense.modePaiement || 'ESPECES', utilisateurId: depense.utilisateurId, entiteId: depense.entiteId })
        }
      } else if (refType === 'CHARGE') {
        const charge = await prisma.charge.findUnique({ where: { id: refId }, select: { date: true, montant: true, rubrique: true, observation: true, utilisateurId: true, entiteId: true, magasinId: true, modePaiement: true } })
        if (charge) {
          await comptabiliserCharge({ chargeId: refId, date: charge.date, montant: Number(charge.montant), rubrique: charge.rubrique, libelle: charge.observation ?? undefined, utilisateurId: charge.utilisateurId, entiteId: charge.entiteId, magasinId: charge.magasinId, modePaiement: charge.modePaiement })
        }
      } else if (refType === 'VENTE_REGLEMENT') {
        const reglement = await prisma.reglementVente.findUnique({ where: { id: refId }, include: { vente: { select: { numero: true, entiteId: true } } } })
        if (reglement) {
          await comptabiliserReglementVente({ venteId: reglement.venteId || 0, numeroVente: reglement.vente?.numero || '', date: reglement.date, montant: Number(reglement.montant), modePaiement: reglement.modePaiement || 'ESPECES', utilisateurId: reglement.utilisateurId, entiteId: reglement.vente?.entiteId || 1 })
        }
      } else if (refType === 'ACHAT_REGLEMENT') {
        const reglement = await prisma.reglementAchat.findUnique({ where: { id: refId }, include: { achat: { select: { numero: true, entiteId: true } } } })
        if (reglement) {
          await comptabiliserReglementAchat({ achatId: reglement.achatId || 0, numeroAchat: reglement.achat?.numero || '', date: reglement.date, montant: Number(reglement.montant), modePaiement: reglement.modePaiement || 'ESPECES', utilisateurId: reglement.utilisateurId, entiteId: reglement.achat?.entiteId || 1 })
        }
      }
    }

    await prisma.ecritureComptable.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/ecritures/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
