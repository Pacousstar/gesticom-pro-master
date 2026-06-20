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
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { ecritureSchema } from '@/lib/validations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
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
  } catch (e) {
    await apiCatch(e, 'api/ecritures/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const validation = validateApiRequest(ecritureSchema.partial(), body)
    if (!validation.success) return validation.response
    const data = validation.data

    const updateData: Record<string, unknown> = {}

    if (data.date) updateData.date = new Date(data.date)
    if (data.journalId != null) {
      const jId = data.journalId
      const journal = await prisma.journal.findUnique({ where: { id: jId } })
      if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 400 })
      updateData.journalId = jId
    }
    if (data.piece !== undefined) updateData.piece = data.piece ?? null
    if (data.libelle != null) updateData.libelle = data.libelle
    if (data.compteId != null) {
      const cId = data.compteId
      const compte = await prisma.planCompte.findUnique({ where: { id: cId } })
      if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 })
      updateData.compteId = cId
    }
    if (data.debit != null) updateData.debit = data.debit
    if (data.credit != null) updateData.credit = data.credit

    const debit = updateData.debit as number | undefined
    const credit = updateData.credit as number | undefined
    if (debit !== undefined && credit !== undefined) {
      if (debit === 0 && credit === 0) {
        return NextResponse.json({ error: 'Débit ou crédit doit être supérieur à 0.' }, { status: 400 })
      }
      if (debit > 0 && credit > 0) {
        return NextResponse.json({ error: 'Une écriture ne peut avoir à la fois un débit et un crédit.' }, { status: 400 })
      }
    }

    if (data.reference !== undefined) updateData.reference = data.reference ?? null
    if (data.referenceType !== undefined) updateData.referenceType = data.referenceType ?? null
    if (data.referenceId !== undefined) updateData.referenceId = data.referenceId

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
          select: {
            numero: true, date: true, montantTotal: true, modePaiement: true,
            clientId: true, utilisateurId: true, entiteId: true, magasinId: true,
            fraisApproche: true,
            lignes: { select: { produitId: true, designation: true, quantite: true, prixUnitaire: true, coutUnitaire: true, tva: true, remise: true } },
            reglements: { select: { modePaiement: true, montant: true } },
          },
        })
        if (vente) {
          if (refType === 'VENTE') {
            const lignesData = vente.lignes.map((l: any) => ({
              produitId: l.produitId, designation: l.designation, quantite: l.quantite,
              prixUnitaire: l.prixUnitaire, coutUnitaire: l.coutUnitaire, tva: l.tva, remise: l.remise,
            }))
            const regsData = vente.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant }))
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
              fraisApproche: Number(vente.fraisApproche || 0),
              reglements: regsData,
              lignes: lignesData,
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
          select: {
            numero: true, date: true, montantTotal: true, modePaiement: true,
            fournisseurId: true, utilisateurId: true, entiteId: true, magasinId: true,
            fraisApproche: true,
            lignes: { select: { produitId: true, designation: true, quantite: true, prixUnitaire: true, tva: true, remise: true } },
            reglements: { select: { modePaiement: true, montant: true } },
          },
        })
        if (achat) {
          if (refType === 'ACHAT') {
            const lignesData = achat.lignes.map((l: any) => ({
              produitId: l.produitId, designation: l.designation, quantite: l.quantite,
              prixUnitaire: l.prixUnitaire, tva: l.tva, remise: l.remise,
            }))
            const regsData = achat.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant }))
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
              fraisApproche: Number(achat.fraisApproche || 0),
              reglements: regsData,
              lignes: lignesData,
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
    await apiCatch(e, 'api/ecritures/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

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
        const vente = await prisma.vente.findUnique({
          where: { id: refId },
          select: {
            numero: true, date: true, montantTotal: true, modePaiement: true,
            clientId: true, utilisateurId: true, entiteId: true, magasinId: true,
            fraisApproche: true,
            lignes: { select: { produitId: true, designation: true, quantite: true, prixUnitaire: true, coutUnitaire: true, tva: true, remise: true } },
            reglements: { select: { modePaiement: true, montant: true } },
          },
        })
        if (vente) {
          const lignesData = vente.lignes.map((l: any) => ({
            produitId: l.produitId, designation: l.designation, quantite: l.quantite,
            prixUnitaire: l.prixUnitaire, coutUnitaire: l.coutUnitaire, tva: l.tva, remise: l.remise,
          }))
          const regsData = vente.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant }))
          await comptabiliserVente({ venteId: refId, numeroVente: vente.numero, date: vente.date, montantTotal: Number(vente.montantTotal), modePaiement: vente.modePaiement || 'ESPECES', clientId: vente.clientId ?? undefined, utilisateurId: vente.utilisateurId, entiteId: vente.entiteId, magasinId: vente.magasinId, fraisApproche: Number(vente.fraisApproche || 0), reglements: regsData, lignes: lignesData })
        }
      } else if (refType === 'ACHAT') {
        const achat = await prisma.achat.findUnique({
          where: { id: refId },
          select: {
            numero: true, date: true, montantTotal: true, modePaiement: true,
            fournisseurId: true, utilisateurId: true, entiteId: true, magasinId: true,
            fraisApproche: true,
            lignes: { select: { produitId: true, designation: true, quantite: true, prixUnitaire: true, tva: true, remise: true } },
            reglements: { select: { modePaiement: true, montant: true } },
          },
        })
        if (achat) {
          const lignesData = achat.lignes.map((l: any) => ({
            produitId: l.produitId, designation: l.designation, quantite: l.quantite,
            prixUnitaire: l.prixUnitaire, tva: l.tva, remise: l.remise,
          }))
          const regsData = achat.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant }))
          await comptabiliserAchat({ achatId: refId, numeroAchat: achat.numero, date: achat.date, montantTotal: Number(achat.montantTotal), modePaiement: achat.modePaiement || 'ESPECES', fournisseurId: achat.fournisseurId ?? undefined, utilisateurId: achat.utilisateurId, entiteId: achat.entiteId, magasinId: achat.magasinId, fraisApproche: Number(achat.fraisApproche || 0), reglements: regsData, lignes: lignesData })
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
    await apiCatch(e, 'api/ecritures/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
