import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

const MODES_ESPECES = ['ESPECES', 'CASH', 'ESPECE']

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'caisse:view')
  if (authError) return authError
  const entiteId = await getEntiteId(session)

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()

  const whereDate: any = {}
  if (dateDebut && dateFin) {
    whereDate.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  const whereEntite: any = entiteId ? { entiteId } : {}
  const whereMagasin: any = magasinIdParam ? { magasinId: Number(magasinIdParam) } : {}

  // 1. Reglements Vente (Entrées) — RC5 : exclure ESPECE singulier aussi
  const reglementsVente = await prisma.reglementVente.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: MODES_ESPECES },
      statut: { in: ['VALIDE', 'VALIDEE'] },
      OR: [
        { vente: { ...whereMagasin, ...whereEntite } },
        { venteId: null, ...whereEntite }
      ]
    },
    select: { montant: true, modePaiement: true }
  })

  // 2. Reglements Achat (Sorties) — RC5 : exclure ESPECE singulier aussi
  const reglementsAchat = await prisma.reglementAchat.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: MODES_ESPECES },
      statut: { in: ['VALIDE', 'VALIDEE'] },
      OR: [
        { achat: { ...whereMagasin, ...whereEntite } },
        { achatId: null, ...whereEntite }
      ]
    },
    select: { montant: true, modePaiement: true }
  })

  // 3. Caisse (Mouvements manuels - tjrs considérés comme ESPECES)
  const caisseMouvements = await prisma.caisse.findMany({
    where: {
      ...whereDate,
      ...whereMagasin,
      magasin: whereEntite,
    },
    select: { montant: true, type: true }
  })

  // 4. Depenses (Sorties) — uniquement les montants payés
  const depenses = await prisma.depense.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: MODES_ESPECES },
      montantPaye: { gt: 0 },
      ...whereMagasin,
      ...whereEntite,
    },
    select: { montantPaye: true, modePaiement: true }
  })

  // 4b. Charges (Sorties) — modes bancaires uniquement
  const charges = await prisma.charge.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: MODES_ESPECES },
      statut: { in: ['VALIDE', 'VALIDEE'] },
      ...whereEntite,
    },
    select: { montant: true, modePaiement: true }
  })

  // 5. Crédits Clients (Ventes)
  const creditsClients = await prisma.vente.findMany({
    where: {
      ...whereDate,
      ...whereMagasin,
      ...whereEntite,
      statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    },
    select: { montantTotal: true, montantPaye: true }
  })

  // 7. Opérations Bancaires manuelles (Période)
  const opsBancaires = await prisma.operationBancaire.findMany({
    where: {
      ...whereDate,
      banque: whereEntite
    },
    select: { montant: true, type: true }
  })

  const stats = { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 }
  const ouvertures = { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 }
  const mouvements = { ESPECES: { entrees: 0, sorties: 0 }, MOBILE_MONEY: { entrees: 0, sorties: 0 }, VIREMENT: { entrees: 0, sorties: 0 }, CHEQUE: { entrees: 0, sorties: 0 } }

  // --- 5. CALCUL DU SOLDE D'OUVERTURE (Avant dateDebut) ---
  if (dateDebut) {
    const startOfPeriod = new Date(dateDebut + 'T00:00:00')
    const wherePast: any = { date: { lt: startOfPeriod } }
    
    // Ventes passées (Exclu Espèces) — RC5
    const pastVentes = await prisma.reglementVente.findMany({
      where: { ...wherePast, modePaiement: { notIn: MODES_ESPECES }, statut: { in: ['VALIDE', 'VALIDEE'] }, OR: [ { vente: { ...whereMagasin, ...whereEntite } }, { venteId: null, ...whereEntite } ] },
      select: { montant: true, modePaiement: true }
    })
    pastVentes.forEach(r => {
      const mode = mapMode(r.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] += r.montant
    })

    // Achats passés (Exclu Espèces) — RC5
    const pastAchats = await prisma.reglementAchat.findMany({
      where: { ...wherePast, modePaiement: { notIn: MODES_ESPECES }, statut: { in: ['VALIDE', 'VALIDEE'] }, OR: [ { achat: { ...whereMagasin, ...whereEntite } }, { achatId: null, ...whereEntite } ] },
      select: { montant: true, modePaiement: true }
    })
    pastAchats.forEach(r => {
      const mode = mapMode(r.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] -= r.montant
    })

    // Caisse passée (SOURCE UNIQUE POUR LES ESPÈCES)
    const pastCaisse = await prisma.caisse.findMany({
      where: { ...wherePast, ...whereMagasin, magasin: whereEntite },
      select: { montant: true, type: true }
    })
    pastCaisse.forEach(c => {
      if (c.type === 'ENTREE') ouvertures.ESPECES += c.montant
      else ouvertures.ESPECES -= c.montant
    })

    // Opérations Bancaires passées — exclure REGLEMENT_CLIENT/FOURNISSEUR et VENTE (déjà comptés dans reglements)
    const pastOpsBanque = await prisma.operationBancaire.findMany({
      where: { date: { lt: startOfPeriod }, banque: whereEntite },
      select: { montant: true, type: true }
    })
    pastOpsBanque.forEach(o => {
      if (['REGLEMENT_CLIENT', 'REGLEMENT_FOURNISSEUR', 'VENTE', 'ACHAT', 'DEPENSE', 'CHARGE'].includes(o.type)) return
      const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(o.type)
      if (isEntree) ouvertures.VIREMENT += o.montant
      else ouvertures.VIREMENT -= o.montant
    })

    // Dépenses passées — uniquement les montants payés
    const pastDepenses = await prisma.depense.findMany({
      where: { ...wherePast, modePaiement: { notIn: MODES_ESPECES }, montantPaye: { gt: 0 }, ...whereMagasin, ...whereEntite },
      select: { montantPaye: true, modePaiement: true }
    })
    pastDepenses.forEach(d => {
      const mode = mapMode(d.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] -= d.montantPaye
    })

    // Charges passées — modes bancaires uniquement
    const pastCharges = await prisma.charge.findMany({
      where: { ...wherePast, modePaiement: { notIn: MODES_ESPECES }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...whereEntite },
      select: { montant: true, modePaiement: true }
    })
    pastCharges.forEach(c => {
      const mode = mapMode(c.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] -= c.montant
    })
  }

  // Agrégation Ventes (Période)
  reglementsVente.forEach(r => {
    const mode = mapMode(r.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) {
      stats[mode] += r.montant
      mouvements[mode].entrees += r.montant
    }
  })

  // Agrégation Achats (Période)
  reglementsAchat.forEach(r => {
    const mode = mapMode(r.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) {
      stats[mode] -= r.montant
      mouvements[mode].sorties += r.montant
    }
  })

  // Agrégation Caisse (Manuelle - Période)
  caisseMouvements.forEach(c => {
    if (c.type === 'ENTREE') {
      stats.ESPECES += c.montant
      mouvements.ESPECES.entrees += c.montant
    } else {
      stats.ESPECES -= c.montant
      mouvements.ESPECES.sorties += c.montant
    }
  })

  // Agrégation OP BANQUE (Période) — on exclut les types déjà comptés via reglements, depenses et charges
  opsBancaires.forEach(o => {
    if (['REGLEMENT_CLIENT', 'REGLEMENT_FOURNISSEUR', 'VENTE', 'ACHAT', 'DEPENSE', 'CHARGE'].includes(o.type)) return
    const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(o.type)
    if (isEntree) {
      stats.VIREMENT += o.montant
      mouvements.VIREMENT.entrees += o.montant
    } else {
      stats.VIREMENT -= o.montant
      mouvements.VIREMENT.sorties += o.montant
    }
  })

  // Agrégation Depenses (Période) — montantPaye payé uniquement
  depenses.forEach(d => {
    const mode = mapMode(d.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) {
      stats[mode] -= d.montantPaye
      mouvements[mode].sorties += d.montantPaye
    }
  })

  // Agrégation Charges (Période)
  charges.forEach(c => {
    const mode = mapMode(c.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) {
      stats[mode] -= c.montant
      mouvements[mode].sorties += c.montant
    }
  })

  // RC7 : Crédits fournisseurs — filtrer aussi les achats annulés
  const creditsFournisseurs = await prisma.achat.findMany({
    where: {
      ...whereDate,
      ...whereMagasin,
      ...whereEntite,
      statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    },
    select: { montantTotal: true, montantPaye: true }
  })

  // Calcul des totaux Crédits
  const creditClientTotal = creditsClients.reduce((acc, v) => acc + (v.montantTotal - (v.montantPaye || 0)), 0)
  const creditFournisseurTotal = creditsFournisseurs.reduce((acc, a) => acc + (a.montantTotal - (a.montantPaye || 0)), 0)

  return NextResponse.json({ 
    stats, 
    ouvertures,
    mouvements,
    credits: {
      client: { total: creditClientTotal, count: creditsClients.length },
      fournisseur: { total: creditFournisseurTotal, count: creditsFournisseurs.length }
    }
  })
}

function mapMode(mode: string): keyof typeof stats | string {
  const m = mode?.toUpperCase() || ''
  if (m === 'ESPECES' || m === 'CASH' || m === 'ESPECE') return 'ESPECES'
  if (m === 'MOBILE_MONEY' || m === 'MOMO' || m === 'ORANGE MONEY' || m === 'WAVE') return 'MOBILE_MONEY'
  if (m === 'VIREMENT' || m === 'BANQUE') return 'VIREMENT'
  if (m === 'CHEQUE') return 'CHEQUE'
  return m
}

const stats = {
  ESPECES: 0,
  MOBILE_MONEY: 0,
  VIREMENT: 0,
  CHEQUE: 0
}