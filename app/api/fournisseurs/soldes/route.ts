import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'fournisseurs:view')
  if (authError) return authError

  const entiteIdFilter = await getEntiteIdOrAll(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  // Build reusable entiteId filter
  const entiteId: number | undefined = entiteIdFilter != null
    ? entiteIdFilter
    : (searchParams.get('entiteId')?.trim() ? Number(searchParams.get('entiteId')?.trim()) : undefined)
  const entiteFilter = entiteId != null ? { entiteId } : {}

  try {
    const fournisseurs = await prisma.fournisseur.findMany({
      where: { actif: true, ...entiteFilter },
      select: {
        id: true,
        code: true,
        nom: true,
        telephone: true,
        localisation: true,
        soldeInitial: true,
        avoirInitial: true,
      },
      orderBy: { nom: 'asc' },
    })

    const whereAchat: any = {
      ...entiteFilter,
      fournisseurId: { not: null },
    }
    
    const whereReglement: any = {
      ...entiteFilter,
      statut: { in: ['VALIDE', 'VALIDEE'] },
    }

    if (dateDebut && dateFin) {
      const gte = new Date(dateDebut + 'T00:00:00')
      const lte = new Date(dateFin + 'T23:59:59')
      whereAchat.date = { gte, lte }
      whereReglement.date = { gte, lte }
    }

    // Achats de la période
    const achats = await prisma.achat.groupBy({
      by: ['fournisseurId'],
      // Achat.statut est "VALIDEE" (schema) ; compat avec anciennes valeurs "VALIDE"
      where: { ...whereAchat, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montantTotal: true, fraisApproche: true },
    })

    // Règlements de la période
    const reglements = await prisma.reglementAchat.groupBy({
      by: ['fournisseurId'],
      where: whereReglement,
      _sum: { montant: true },
    })

    // CL-01: Totaux globaux respectent le filtre période si spécifié
    const whereAchatGlobal: any = { ...entiteFilter, fournisseurId: { not: null }, statut: { in: ['VALIDE', 'VALIDEE'] } }
    const whereReglementGlobal: any = { ...entiteFilter, statut: { in: ['VALIDE', 'VALIDEE'] } }
    if (dateDebut) {
      whereAchatGlobal.date = { ...whereAchatGlobal.date, gte: new Date(dateDebut) }
      whereReglementGlobal.date = { ...whereReglementGlobal.date, gte: new Date(dateDebut) }
    }
    if (dateFin) {
      whereAchatGlobal.date = { ...whereAchatGlobal.date, lte: new Date(dateFin) }
      whereReglementGlobal.date = { ...whereReglementGlobal.date, lte: new Date(dateFin) }
    }

    const achatsGlobaux = await prisma.achat.groupBy({
      by: ['fournisseurId'],
      where: whereAchatGlobal,
      _sum: { montantTotal: true, fraisApproche: true },
    })

    const reglementsGlobaux = await prisma.reglementAchat.groupBy({
      by: ['fournisseurId'],
      where: { ...whereReglementGlobal, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })

    const achatMap = Object.fromEntries(achats.map((a: any) => [a.fournisseurId, (a._sum.montantTotal || 0)]))
    const reglementMap = Object.fromEntries(reglements.map((r: any) => [r.fournisseurId, r._sum.montant || 0]))
    const achatGlobalMap = Object.fromEntries(achatsGlobaux.map((a: any) => [a.fournisseurId, (a._sum.montantTotal || 0)]))
    const reglementGlobalMap = Object.fromEntries(reglementsGlobaux.map((r: any) => [r.fournisseurId, r._sum.montant || 0]))

    const data = await Promise.all(fournisseurs.map(async (f: any) => {
      const totalAchats = achatMap[f.id] || 0
      const totalPaiements = reglementMap[f.id] || 0
      
      const totalAchatsGlobal = achatGlobalMap[f.id] || 0
      const totalPaiementsGlobal = reglementGlobalMap[f.id] || 0
      // ✅ FORMULE UNIFIÉE : SoldeGlobal = Dettes(achats-paiements) + DetteDépart - AvoirDépart
      const soldeGlobal = (totalAchatsGlobal - totalPaiementsGlobal) + (f.soldeInitial || 0) - (f.avoirInitial || 0)

      // R3: Récupérer le numéro de la dernière facture validée
      const derA = await prisma.achat.findFirst({
        where: { fournisseurId: f.id, ...entiteFilter, statut: { in: ['VALIDEE', 'VALIDE'] } },
        orderBy: { date: 'desc' },
        select: { numero: true }
      })

      return {
        ...f,
        achats: totalAchats,
        paiements: totalPaiements,
        variationPeriode: totalAchats - totalPaiements,
        soldeGlobal,
        derniereFacture: derA?.numero || null
      }
    }))

    // Calcul des totaux pour le dashboard
    const totalDettes = data.reduce((sum, f) => sum + (f.soldeGlobal || 0), 0)
    const totalAchats = data.reduce((sum, f) => sum + (f.achats || 0), 0)
    const totalPaiements = data.reduce((sum, f) => sum + (f.paiements || 0), 0)

    return NextResponse.json({ fournisseurs: data, totalDettes, totalAchats, totalPaiements }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('GET /api/fournisseurs/soldes:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
