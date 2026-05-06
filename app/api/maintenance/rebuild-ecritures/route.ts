import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import {
  comptabiliserAchat,
  comptabiliserCaisse,
  comptabiliserCharge,
  comptabiliserDepense,
  comptabiliserMouvementStock,
  comptabiliserReglementAchat,
  comptabiliserReglementVente,
  comptabiliserVente,
} from '@/lib/comptabilisation'

function isEnabled() {
  return process.env.ENABLE_DANGEROUS_MAINTENANCE === 'true'
}

function parseDateOrThrow(input: unknown, field: string): Date {
  const raw = String(input || '').trim()
  if (!raw) throw new Error(`${field} requis (YYYY-MM-DD).`)
  // On force le début de journée locale pour éviter les surprises UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 0, 0, 0)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) throw new Error(`${field} invalide.`)
  return dt
}

export async function POST(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.json(
      { error: 'Maintenance désactivée. Mettre ENABLE_DANGEROUS_MAINTENANCE=true.' },
      { status: 403 }
    )
  }

  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const logs: string[] = []
  try {
    const body = await request.json().catch(() => ({}))
    const startDate = parseDateOrThrow(body?.startDate, 'startDate')
    const endDate = body?.endDate ? parseDateOrThrow(body.endDate, 'endDate') : null

    const entiteIdFromSession = await getEntiteId(session)
    const entiteId = body?.entiteId ? Number(body.entiteId) : entiteIdFromSession
    if (!entiteId || !Number.isFinite(entiteId)) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    logs.push(`🏁 Rebuild écritures >= ${startDate.toISOString()}${endDate ? ` <= ${endDate.toISOString()}` : ''} (entité ${entiteId})`)

    const dateWhere: any = endDate
      ? { gte: startDate, lte: new Date(endDate.getTime() + 24 * 3600 * 1000 - 1) }
      : { gte: startDate }

    // 0) Journaux/comptes: ils sont upsertés à la volée, donc rien à faire ici.

    // 1) VENTES + TVA + STOCK + FRAIS + REGLEMENTS (via comptabiliserVente)
    const ventes = await prisma.vente.findMany({
      where: {
        entiteId,
        statut: { in: ['VALIDE', 'VALIDEE'] },
        date: dateWhere,
      },
      include: {
        lignes: true,
        reglements: { select: { modePaiement: true, montant: true } },
      },
      orderBy: { date: 'asc' },
    })
    logs.push(`Ventes à recalculer: ${ventes.length}`)
    for (const v of ventes) {
      await comptabiliserVente({
        venteId: v.id,
        numeroVente: v.numero,
        date: v.date,
        montantTotal: v.montantTotal,
        modePaiement: v.modePaiement,
        clientId: v.clientId,
        entiteId: v.entiteId,
        utilisateurId: v.utilisateurId,
        magasinId: v.magasinId,
        fraisApproche: v.fraisApproche,
        reglements: (v.reglements || []).map((r) => ({ mode: r.modePaiement, montant: r.montant })),
        lignes: (v.lignes || []).map((l) => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          coutUnitaire: l.coutUnitaire,
          tva: l.tva,
          remise: l.remise,
        })),
      })
    }

    // 2) ACHATS + TVA + STOCK + FRAIS + REGLEMENTS (via comptabiliserAchat)
    const achats = await prisma.achat.findMany({
      where: {
        entiteId,
        statut: { in: ['VALIDE', 'VALIDEE'] },
        date: dateWhere,
      },
      include: {
        lignes: true,
        reglements: { select: { modePaiement: true, montant: true } },
      },
      orderBy: { date: 'asc' },
    })
    logs.push(`Achats à recalculer: ${achats.length}`)
    for (const a of achats) {
      await comptabiliserAchat({
        achatId: a.id,
        numeroAchat: a.numero,
        date: a.date,
        montantTotal: a.montantTotal,
        fraisApproche: a.fraisApproche,
        modePaiement: a.modePaiement,
        fournisseurId: a.fournisseurId,
        entiteId: a.entiteId,
        utilisateurId: a.utilisateurId,
        magasinId: a.magasinId,
        reglements: (a.reglements || []).map((r) => ({ mode: r.modePaiement, montant: r.montant })),
        lignes: (a.lignes || []).map((l) => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva,
          remise: l.remise,
        })),
      })
    }

    // 3) Règlements libres (acompte client/fournisseur) et règlements hors recomptabilisation (sécurité)
    // On recalcule quand même les écritures de règlement à partir des règlements eux-mêmes.
    const regVentes = await prisma.reglementVente.findMany({
      where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] }, date: dateWhere },
      include: { vente: { select: { numero: true, entiteId: true } } },
      orderBy: { date: 'asc' },
    })
    logs.push(`Règlements ventes à recalculer: ${regVentes.length}`)
    for (const r of regVentes) {
      await comptabiliserReglementVente({
        reglementId: r.id,
        venteId: r.venteId ?? 0,
        numeroVente: r.vente?.numero || `AC-CLI-${r.clientId || r.id}`,
        date: r.date,
        montant: r.montant,
        modePaiement: r.modePaiement,
        utilisateurId: r.utilisateurId,
        entiteId: r.entiteId ?? r.vente?.entiteId ?? entiteId,
      })
    }

    const regAchats = await prisma.reglementAchat.findMany({
      where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] }, date: dateWhere },
      include: { achat: { select: { numero: true, entiteId: true } } },
      orderBy: { date: 'asc' },
    })
    logs.push(`Règlements achats à recalculer: ${regAchats.length}`)
    for (const r of regAchats) {
      await comptabiliserReglementAchat({
        reglementId: r.id,
        achatId: r.achatId ?? 0,
        numeroAchat: r.achat?.numero || `AC-FOURN-${r.fournisseurId || r.id}`,
        date: r.date,
        montant: r.montant,
        modePaiement: r.modePaiement,
        utilisateurId: r.utilisateurId,
        entiteId: r.entiteId ?? r.achat?.entiteId ?? entiteId,
      })
    }

    // 4) Dépenses
    const depenses = await prisma.depense.findMany({
      where: { entiteId, date: dateWhere },
      orderBy: { date: 'asc' },
    })
    logs.push(`Dépenses à recalculer: ${depenses.length}`)
    for (const d of depenses) {
      await comptabiliserDepense({
        depenseId: d.id,
        date: d.date,
        montant: d.montant,
        categorie: d.categorie,
        libelle: d.libelle,
        modePaiement: d.modePaiement,
        utilisateurId: d.utilisateurId,
        entiteId: d.entiteId,
        magasinId: d.magasinId,
      })
    }

    // 5) Charges
    const charges = await prisma.charge.findMany({
      where: { entiteId, date: dateWhere },
      orderBy: { date: 'asc' },
    })
    logs.push(`Charges à recalculer: ${charges.length}`)
    for (const c of charges) {
      await comptabiliserCharge({
        chargeId: c.id,
        date: c.date,
        montant: c.montant,
        rubrique: c.rubrique,
        libelle: c.observation ?? undefined,
        utilisateurId: c.utilisateurId,
        entiteId: c.entiteId,
        magasinId: c.magasinId,
        modePaiement: (c as any).modePaiement,
      })
    }

    // 6) Caisse manuelle (comptabiliserCaisse)
    const caisses = await prisma.caisse.findMany({
      where: {
        entiteId,
        date: dateWhere,
      },
      orderBy: { date: 'asc' },
    })
    logs.push(`Caisse à recalculer: ${caisses.length}`)
    for (const c of caisses) {
      await comptabiliserCaisse({
        caisseId: c.id,
        date: c.date,
        type: c.type as 'ENTREE' | 'SORTIE',
        montant: c.montant,
        motif: c.motif,
        utilisateurId: c.utilisateurId,
        entiteId: c.entiteId,
      })
    }

    // 7) Ajustements stock (stock initial / inventaire / régul manuelle)
    const mvtStocks = await prisma.mouvement.findMany({
      where: {
        entiteId,
        dateOperation: dateWhere,
        OR: [
          { observation: { contains: 'Stock initial' } },
          { observation: { contains: 'Inventaire' } },
          { observation: { contains: 'Régul' } },
          { observation: { contains: 'Ajust' } },
        ],
      },
      orderBy: { dateOperation: 'asc' },
    })
    logs.push(`Mouvements stock (ajustements) à recalculer: ${mvtStocks.length}`)
    for (const m of mvtStocks) {
      const type = String(m.type).toUpperCase() === 'SORTIE' ? 'SORTIE' : 'ENTREE'
      await comptabiliserMouvementStock({
        produitId: m.produitId,
        magasinId: m.magasinId,
        type: type as 'ENTREE' | 'SORTIE',
        quantite: m.quantite,
        date: m.dateOperation,
        motif: m.observation || 'Ajustement stock',
        utilisateurId: m.utilisateurId,
        entiteId: m.entiteId,
        mouvementId: m.id,
      })
    }

    logs.push('✅ Rebuild terminé.')
    return NextResponse.json({ ok: true, logs })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

