import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'clients:view')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const entiteId = await getEntiteId(session)
  const filtre = searchParams.get('filtre') || 'TOUS'

  const clients = await prisma.client.findMany({
    where: { entiteId, actif: true },
    select: {
      id: true, nom: true, telephone: true, email: true,
      soldeInitial: true, avoirInitial: true, plafondCredit: true,
      ventes: {
        where: { statut: 'VALIDEE' },
        select: { montantTotal: true, montantPaye: true, date: true, id: true, numero: true },
        orderBy: { date: 'desc' },
      },
      reglements: {
        where: { venteId: null, statut: 'VALIDE' },
        select: { montant: true },
      },
      relances: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { date: true, statut: true, montantDu: true },
      },
    },
  })

  const maintenant = Date.now()

  const qualifies = clients.map(c => {
    const detteFactures = c.ventes.reduce((s, v) => s + (v.montantTotal - (v.montantPaye || 0)), 0)
    const totalRegsLibres = c.reglements.reduce((s, r) => s + r.montant, 0)
    const solde = (detteFactures + (c.soldeInitial || 0)) - (totalRegsLibres + (c.avoirInitial || 0))

    if (solde <= 0) return null

    const derniereVente = c.ventes.length > 0 ? c.ventes[0] : null
    const ageJours = derniereVente
      ? Math.floor((maintenant - new Date(derniereVente.date).getTime()) / (24 * 60 * 60 * 1000))
      : 0

    const derniereRelance = c.relances[0]
    const joursDepuisDerniereRelance = derniereRelance
      ? Math.floor((maintenant - new Date(derniereRelance.date).getTime()) / (24 * 60 * 60 * 1000))
      : Infinity

    let tranche: string
    if (ageJours >= 90) tranche = '90J+'
    else if (ageJours >= 60) tranche = '60J'
    else if (ageJours >= 30) tranche = '30J'
    else tranche = 'MOINS_30J'

    const eligibleRelance = solde > 0 && (joursDepuisDerniereRelance >= 7 || !derniereRelance)

    return {
      clientId: c.id,
      nom: c.nom,
      telephone: c.telephone,
      email: c.email,
      solde,
      plafondCredit: c.plafondCredit || 0,
      tranche,
      ageJours,
      nbFactures: c.ventes.length,
      derniereVenteDate: derniereVente?.date || null,
      derniereRelanceDate: derniereRelance?.date || null,
      derniereRelanceStatut: derniereRelance?.statut || null,
      eligibleRelance,
    }
  }).filter((c): c is NonNullable<typeof c> => c !== null)

  const filtered = filtre === 'TOUS' ? qualifies
    : filtre === '30J' ? qualifies.filter(c => c.tranche === '30J')
    : filtre === '60J' ? qualifies.filter(c => c.tranche === '60J')
    : filtre === '90J+' ? qualifies.filter(c => c.tranche === '90J+' || c.tranche === '60J')
    : qualifies

  const stats = {
    total: qualifies.length,
    totalDu: qualifies.reduce((s, c) => s + c.solde, 0),
    eligible: qualifies.filter(c => c.eligibleRelance).length,
    parTranche: {
      '30J': qualifies.filter(c => c.tranche === '30J').length,
      '60J': qualifies.filter(c => c.tranche === '60J').length,
      '90J+': qualifies.filter(c => c.tranche === '90J+').length,
    },
  }

  return NextResponse.json({ clients: filtered, stats })
}
