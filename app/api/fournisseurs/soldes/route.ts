import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  try {
    const fournisseurs = await prisma.fournisseur.findMany({
      where: { actif: true, entiteId },
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
      entiteId,
      fournisseurId: { not: null },
    }
    
    const whereReglement: any = {
      entiteId,
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
      where: { ...whereAchat, statut: 'VALIDE' },
      _sum: { montantTotal: true },
    })

    // Règlements de la période
    const reglements = await prisma.reglementAchat.groupBy({
      by: ['fournisseurId'],
      where: whereReglement,
      _sum: { montant: true },
    })

    // Totaux globaux pour le solde actuel réel
    const achatsGlobaux = await prisma.achat.groupBy({
      by: ['fournisseurId'],
      where: { entiteId, fournisseurId: { not: null }, statut: 'VALIDE' },
      _sum: { montantTotal: true },
    })

    const reglementsGlobaux = await prisma.reglementAchat.groupBy({
      by: ['fournisseurId'],
      where: {
        entiteId,
        statut: 'VALIDE',
      },
      _sum: { montant: true },
    })

    const achatMap = Object.fromEntries(achats.map((a: any) => [a.fournisseurId, a._sum.montantTotal || 0]))
    const reglementMap = Object.fromEntries(reglements.map((r: any) => [r.fournisseurId, r._sum.montant || 0]))
    const achatGlobalMap = Object.fromEntries(achatsGlobaux.map((a: any) => [a.fournisseurId, a._sum.montantTotal || 0]))
    const reglementGlobalMap = Object.fromEntries(reglementsGlobaux.map((r: any) => [r.fournisseurId, r._sum.montant || 0]))

    const data = await Promise.all(fournisseurs.map(async (f: any) => {
      const totalAchats = achatMap[f.id] || 0
      const totalPaiements = reglementMap[f.id] || 0
      
      const totalAchatsGlobal = achatGlobalMap[f.id] || 0
      const totalPaiementsGlobal = reglementGlobalMap[f.id] || 0
      // ✅ FORMULE UNIFIÉE : SoldeGlobal = Dettes(achats-paiements) + DetteDépart - AvoirDépart
      const soldeGlobal = (totalAchatsGlobal - totalPaiementsGlobal) + (f.soldeInitial || 0) - (f.avoirInitial || 0)

      // Récupérer le numéro de la dernière facture d'achat
      const derA = await prisma.achat.findFirst({
        where: { fournisseurId: f.id, entiteId },
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

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/fournisseurs/soldes:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
