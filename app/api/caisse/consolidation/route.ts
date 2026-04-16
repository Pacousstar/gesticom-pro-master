import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
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

  // 1. Reglements Vente (Entrées)
  const reglementsVente = await prisma.reglementVente.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: ['ESPECES', 'CASH'] }, // On exclut les espèces ici pour éviter le double comptage
      statut: { in: ['VALIDE', 'VALIDEE'] },
      vente: { ...whereMagasin, ...whereEntite }
    },
    select: { montant: true, modePaiement: true }
  })

  // 2. Reglements Achat (Sorties)
  const reglementsAchat = await prisma.reglementAchat.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: ['ESPECES', 'CASH'] },
      statut: { in: ['VALIDE', 'VALIDEE'] },
      achat: { ...whereMagasin, ...whereEntite }
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

  // 4. Depenses (Sorties)
  const depenses = await prisma.depense.findMany({
    where: {
      ...whereDate,
      modePaiement: { notIn: ['ESPECES', 'CASH'] },
      ...whereMagasin,
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

  // --- 5. CALCUL DU SOLDE D'OUVERTURE (Avant dateDebut) ---
  if (dateDebut) {
    const startOfPeriod = new Date(dateDebut + 'T00:00:00')
    const wherePast: any = { date: { lt: startOfPeriod } }
    
    // Ventes passées (Exclu Espèces)
    const pastVentes = await prisma.reglementVente.findMany({
      where: { ...wherePast, modePaiement: { notIn: ['ESPECES', 'CASH'] }, statut: { in: ['VALIDE', 'VALIDEE'] }, vente: { ...whereMagasin, ...whereEntite } },
      select: { montant: true, modePaiement: true }
    })
    pastVentes.forEach(r => {
      const mode = mapMode(r.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] += r.montant
    })

    // Achats passés (Exclu Espèces)
    const pastAchats = await prisma.reglementAchat.findMany({
      where: { ...wherePast, modePaiement: { notIn: ['ESPECES', 'CASH'] }, statut: { in: ['VALIDE', 'VALIDEE'] }, achat: { ...whereMagasin, ...whereEntite } },
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

    // Opérations Bancaires passées (Considérées par défaut comme VIREMENT sauf si MoMo précisé)
    const pastOpsBanque = await prisma.operationBancaire.findMany({
      where: { date: { lt: startOfPeriod }, banque: whereEntite },
      select: { montant: true, type: true }
    })
    pastOpsBanque.forEach(o => {
      const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(o.type)
      if (isEntree) ouvertures.VIREMENT += o.montant
      else ouvertures.VIREMENT -= o.montant
    })

    // Dépenses passées (Exclu Espèces)
    const pastDepenses = await prisma.depense.findMany({
      where: { ...wherePast, modePaiement: { notIn: ['ESPECES', 'CASH'] }, ...whereMagasin, ...whereEntite },
      select: { montant: true, modePaiement: true }
    })
    pastDepenses.forEach(d => {
      const mode = mapMode(d.modePaiement) as keyof typeof ouvertures
      if (ouvertures[mode] !== undefined) ouvertures[mode] -= d.montant
    })
  }

  // Agrégation Ventes (Période)
  reglementsVente.forEach(r => {
    const mode = mapMode(r.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) stats[mode] += r.montant
  })

  // Agrégation Achats (Période)
  reglementsAchat.forEach(r => {
    const mode = mapMode(r.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) stats[mode] -= r.montant
  })

  // Agrégation Caisse (Manuelle - Période)
  caisseMouvements.forEach(c => {
    if (c.type === 'ENTREE') stats.ESPECES += c.montant
    else stats.ESPECES -= c.montant
  })

  // Agrégation OP BANQUE (Période)
  opsBancaires.forEach(o => {
    const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(o.type)
    if (isEntree) stats.VIREMENT += o.montant
    else stats.VIREMENT -= o.montant
  })

  // Agrégation Depenses (Période)
  depenses.forEach(d => {
    const mode = mapMode(d.modePaiement) as keyof typeof stats
    if (stats[mode] !== undefined) stats[mode] -= d.montant
  })

  // Récupération des crédits fournisseurs (qui avait été effacé par erreur)
  const creditsFournisseurs = await prisma.achat.findMany({
    where: {
      ...whereDate,
      ...whereMagasin,
      ...whereEntite,
      statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
    },
    select: { montantTotal: true, montantPaye: true }
  })

  // Calcul des totaux Crédits
  const creditClientTotal = creditsClients.reduce((acc, v) => acc + (v.montantTotal - (v.montantPaye || 0)), 0)
  const creditFournisseurTotal = creditsFournisseurs.reduce((acc, a) => acc + (a.montantTotal - (a.montantPaye || 0)), 0)

  return NextResponse.json({ 
    stats, 
    ouvertures,
    credits: {
      client: { total: creditClientTotal, count: creditsClients.length },
      fournisseur: { total: creditFournisseurTotal, count: creditsFournisseurs.length }
    }
  })
}

function mapMode(mode: string): keyof typeof stats | string {
  const m = mode?.toUpperCase() || ''
  if (m === 'ESPECES' || m === 'CASH') return 'ESPECES'
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
