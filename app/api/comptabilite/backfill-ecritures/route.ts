/**
 * Génère les écritures comptables manquantes pour les ventes, achats et dépenses
 * déjà présents en base (ex. après import depuis l'ancienne base).
 * POST /api/comptabilite/backfill-ecritures
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  comptabiliserDepense,
  comptabiliserCharge,
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserReglementVente,
  comptabiliserReglementAchat,
} from '@/lib/comptabilisation'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const created = { ventes: 0, achats: 0, depenses: 0, charges: 0, reglementsVentes: 0, reglementsAchats: 0, errors: [] as string[] }
  const sansEcriture = { ventes: 0, achats: 0, depenses: 0, charges: 0 }

  try {
    // Ventes sans écriture
    const ventesAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'VENTE' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const ventesSansEcriture = await prisma.vente.findMany({
      where: { id: { notIn: [...ventesAvecEcriture] }, statut: 'VALIDEE' },
      select: {
        id: true,
        numero: true,
        date: true,
        montantTotal: true,
        modePaiement: true,
        clientId: true,
        utilisateurId: true,
        magasinId: true,
        entiteId: true,
      },
      orderBy: { date: 'asc' },
    })
    sansEcriture.ventes = ventesSansEcriture.length

    for (const v of ventesSansEcriture) {
      try {
        await comptabiliserVente({
          venteId: v.id,
          numeroVente: v.numero,
          date: v.date,
          montantTotal: Number(v.montantTotal),
          modePaiement: v.modePaiement || 'ESPECES',
          clientId: v.clientId ?? undefined,
          utilisateurId: v.utilisateurId,
          magasinId: v.magasinId,
          entiteId: v.entiteId,
        })
        created.ventes++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        created.errors.push(`Vente ${v.numero}: ${msg}`)
      }
    }

    // Achats sans écriture
    const achatsAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'ACHAT' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const achatsSansEcriture = await prisma.achat.findMany({
      where: { id: { notIn: [...achatsAvecEcriture] } },
      select: {
        id: true,
        numero: true,
        date: true,
        montantTotal: true,
        modePaiement: true,
        fournisseurId: true,
        utilisateurId: true,
        magasinId: true,
        entiteId: true,
      },
      orderBy: { date: 'asc' },
    })
    sansEcriture.achats = achatsSansEcriture.length

    for (const a of achatsSansEcriture) {
      try {
        await comptabiliserAchat({
          achatId: a.id,
          numeroAchat: a.numero,
          date: a.date,
          montantTotal: Number(a.montantTotal),
          modePaiement: a.modePaiement || 'ESPECES',
          fournisseurId: a.fournisseurId ?? undefined,
          utilisateurId: a.utilisateurId,
          magasinId: a.magasinId,
          entiteId: a.entiteId,
        })
        created.achats++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        created.errors.push(`Achat ${a.numero}: ${msg}`)
      }
    }

    // Dépenses sans écriture
    const depensesAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'DEPENSE' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const depensesSansEcriture = await prisma.depense.findMany({
      where: { id: { notIn: [...depensesAvecEcriture] } },
      select: {
        id: true,
        date: true,
        montant: true,
        categorie: true,
        libelle: true,
        modePaiement: true,
        utilisateurId: true,
      },
      orderBy: { date: 'asc' },
    })
    sansEcriture.depenses = depensesSansEcriture.length

    for (const d of depensesSansEcriture) {
      try {
        await comptabiliserDepense({
          depenseId: d.id,
          date: d.date,
          montant: Number(d.montant),
          categorie: d.categorie,
          libelle: d.libelle,
          modePaiement: d.modePaiement || 'ESPECES',
          utilisateurId: d.utilisateurId,
        })
        created.depenses++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        created.errors.push(`Dépense ${d.id}: ${msg}`)
      }
    }

    // Charges sans écriture
    const chargesAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'CHARGE' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const chargesSansEcriture = await prisma.charge.findMany({
      where: { id: { notIn: [...chargesAvecEcriture] } },
      select: {
        id: true,
        date: true,
        montant: true,
        rubrique: true,
        observation: true,
        utilisateurId: true,
      },
      orderBy: { date: 'asc' },
    })
    sansEcriture.charges = chargesSansEcriture.length

    for (const c of chargesSansEcriture) {
      try {
        await comptabiliserCharge({
          chargeId: c.id,
          date: c.date,
          montant: Number(c.montant),
          rubrique: c.rubrique,
          libelle: c.observation ?? undefined,
          utilisateurId: c.utilisateurId,
        })
        created.charges++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        created.errors.push(`Charge ${c.id}: ${msg}`)
      }
    }

    // Règlements Ventes sans écriture
    const regsVentesAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'VENTE_REGLEMENT' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const regsVentesSansEcriture = await prisma.reglementVente.findMany({
      where: { id: { notIn: [...regsVentesAvecEcriture] } },
      include: { vente: { select: { numero: true } } },
      orderBy: { date: 'asc' },
    })

    for (const r of regsVentesSansEcriture) {
      try {
        await comptabiliserReglementVente({
          venteId: r.venteId || 0,
          numeroVente: r.vente?.numero || `REG-LIBRE-${r.id}`,
          date: r.date,
          montant: Number(r.montant),
          modePaiement: r.modePaiement || 'ESPECES',
          utilisateurId: r.utilisateurId,
        })
        created.reglementsVentes++
      } catch (e: unknown) {
        created.errors.push(`Règlement Vente ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Règlements Achats sans écriture
    const regsAchatsAvecEcriture = await prisma.ecritureComptable
      .findMany({
        where: { referenceType: 'ACHAT_REGLEMENT' },
        select: { referenceId: true },
        distinct: ['referenceId'],
      })
      .then((rows) => new Set(rows.map((r) => r.referenceId).filter(Boolean) as number[]))

    const regsAchatsSansEcriture = await prisma.reglementAchat.findMany({
      where: { id: { notIn: [...regsAchatsAvecEcriture] } },
      include: { achat: { select: { numero: true } } },
      orderBy: { date: 'asc' },
    })

    for (const r of regsAchatsSansEcriture) {
      try {
        await comptabiliserReglementAchat({
          achatId: r.achatId || 0,
          numeroAchat: r.achat?.numero || `REG-LIBRE-${r.id}`,
          date: r.date,
          montant: Number(r.montant),
          modePaiement: r.modePaiement || 'ESPECES',
          utilisateurId: r.utilisateurId,
        })
        created.reglementsAchats++
      } catch (e: unknown) {
        created.errors.push(`Règlement Achat ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const total =
      created.ventes + created.achats + created.depenses + created.charges + created.reglementsVentes + created.reglementsAchats
    const message = total > 0
      ? `${total} écriture(s) générée(s) (ventes: ${created.ventes}, règlementsV: ${created.reglementsVentes}, achats: ${created.achats}, règlementsA: ${created.reglementsAchats}, dépenses: ${created.depenses}, charges: ${created.charges}).`
      : `Aucune opération sans écriture.`
    if (created.errors.length > 0) {
      created.errors.slice(0, 5).forEach((e) => console.warn('Backfill:', e))
    }
    return NextResponse.json({
      ok: true,
      message: created.errors.length > 0 ? `${message} Erreurs: ${created.errors.length} (voir console).` : message,
      sansEcriture,
      ...created,
    })
  } catch (e) {
    console.error('Backfill écritures:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
