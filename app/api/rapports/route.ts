import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Récupérer l'entiteId de la session
  const entiteId = session.entiteId

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const hasDates = dateDebut && dateFin
  const deb = hasDates ? new Date(dateDebut + 'T00:00:00') : null
  const fin = hasDates ? new Date(dateFin + 'T23:59:59') : null

  // Pagination pour alertes
  const alertesPage = Math.max(1, Number(request.nextUrl.searchParams.get('alertesPage')) || 1)
  const alertesLimit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('alertesLimit')) || 10))
  const alertesSkip = (alertesPage - 1) * alertesLimit

  // Pagination pour top produits
  const topPage = Math.max(1, Number(request.nextUrl.searchParams.get('topPage')) || 1)
  const topLimit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('topLimit')) || 10))
  const topSkip = (topPage - 1) * topLimit

  // Filtres avancés
  const magasinId = request.nextUrl.searchParams.get('magasinId')
  const produitId = request.nextUrl.searchParams.get('produitId')
  const categorie = request.nextUrl.searchParams.get('categorie')

  let topClients: any[] = []

  // Construire les filtres where
  const stockWhere: { produit: { actif: boolean; id?: number; categorie?: { contains: string } }; magasin?: { entiteId?: number; id?: number } } = {
    produit: { actif: true },
  }
  if (entiteId && session.role !== 'SUPER_ADMIN') {
    stockWhere.magasin = { entiteId }
  }
  if (magasinId) {
    stockWhere.magasin = { ...(stockWhere.magasin || {}), id: Number(magasinId) }
  }
  if (produitId) {
    stockWhere.produit = { ...stockWhere.produit, id: Number(produitId) }
  }
  if (categorie) {
    stockWhere.produit = { ...stockWhere.produit, categorie: { contains: categorie } }
  }

  const mouvementWhere: { date?: { gte: Date; lte: Date }; entiteId?: number; produitId?: number; magasinId?: number } = {}
  if (deb && fin) {
    mouvementWhere.date = { gte: deb, lte: fin }
  }
  if (entiteId && session.role !== 'SUPER_ADMIN') {
    mouvementWhere.entiteId = entiteId
  }
  if (produitId) {
    mouvementWhere.produitId = Number(produitId)
  }
  if (magasinId) {
    mouvementWhere.magasinId = Number(magasinId)
  }

  const [stocks, topData, mouvements] = await Promise.all([
    prisma.stock.findMany({
      where: stockWhere,
      include: {
        produit: { select: { id: true, code: true, designation: true, categorie: true, seuilMin: true } },
        magasin: { select: { id: true, code: true, nom: true } },
      },
    }),
    hasDates && deb && fin
      ? prisma.venteLigne.findMany({
        where: {
          vente: {
            date: { gte: deb, lte: fin },
            statut: { in: ['VALIDE', 'VALIDEE'] },
            ...(magasinId ? { magasinId: Number(magasinId) } : {}),
          },
          ...(produitId ? { produitId: Number(produitId) } : {}),
        },
        select: { produitId: true, quantite: true },
      })
      : prisma.venteLigne.groupBy({
        by: ['produitId'],
        _sum: { quantite: true },
        where: {
          vente: {
            ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
            statut: { in: ['VALIDE', 'VALIDEE'] }
          },
          ...(produitId ? { produitId: Number(produitId) } : {}),
        }
      }),
    prisma.mouvement.findMany({
      where: Object.keys(mouvementWhere).length > 0 ? mouvementWhere : undefined,
      take: 50,
      orderBy: { date: 'desc' },
      include: {
        produit: { select: { code: true, designation: true } },
        magasin: { select: { code: true, nom: true } },
      },
    }),
  ])

  const alertesAll = stocks
    .filter((s: any) => s.quantite < s.produit.seuilMin)
    .map((s: any) => ({
      ...s,
      manquant: s.produit.seuilMin - s.quantite,
    }))

  const alertesTotal = alertesAll.length
  const alertes = alertesAll.slice(alertesSkip, alertesSkip + alertesLimit)

  let topProduitsAll: Array<{ produitId: number; code: string; designation: string; quantiteVendue: number }>
  if (hasDates && Array.isArray(topData)) {
    const byId = new Map<number, number>()
    const lignes = topData as Array<{ produitId: number; quantite: number }>
    for (const l of lignes) {
      byId.set(l.produitId, (byId.get(l.produitId) ?? 0) + l.quantite)
    }
    const sorted = [...byId.entries()].sort((a, b) => b[1] - a[1])
    const ids = sorted.map(([id]) => id)
    const prods = await prisma.produit.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, designation: true },
    })
    const prodMap = new Map(prods.map((p: any) => [p.id, p]))
    topProduitsAll = sorted.map(([produitId, q]: [number, number]) => ({
      produitId,
      code: (prodMap as any).get(produitId)?.code ?? '',
      designation: (prodMap as any).get(produitId)?.designation ?? '',
      quantiteVendue: q,
    }))
  } else {
    const topGroup = topData as Array<{ produitId: number; _sum: { quantite: number | null } }>
    const sorted = topGroup.sort((a, b) => (b._sum.quantite ?? 0) - (a._sum.quantite ?? 0))
    const ids = sorted.map((x) => x.produitId)
    const prods = await prisma.produit.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, designation: true },
    })
    const prodMap = new Map(prods.map((p: any) => [p.id, p]))
    topProduitsAll = sorted.map((g: any) => ({
      produitId: g.produitId,
      code: (prodMap as any).get(g.produitId)?.code ?? '',
      designation: (prodMap as any).get(g.produitId)?.designation ?? '',
      quantiteVendue: g._sum.quantite ?? 0,
    }))
  }

  const topProduitsTotal = topProduitsAll.length

  // Comparaison période vs période précédente (si dates fournies)
  let comparaison: {
    periodeActuelle: { ca: number; caEncaisse: number; achats: number; ventes: number }
    periodePrecedente: { ca: number; caEncaisse: number; achats: number; ventes: number }
    evolution: { ca: number; achats: number; ventes: number }
    evolutionPourcent: { ca: number; achats: number; ventes: number }
  } | null = null

  if (hasDates && deb && fin) {
    // Calculer la durée de la période
    const dureeMs = fin.getTime() - deb.getTime()
    const dureeJours = Math.ceil(dureeMs / (1000 * 60 * 60 * 24))

    // Période précédente (même durée, avant la période actuelle)
    const debPrecedent = new Date(deb)
    debPrecedent.setDate(debPrecedent.getDate() - dureeJours - 1)
    const finPrecedent = new Date(deb)
    finPrecedent.setDate(finPrecedent.getDate() - 1)

    const [ventesActuelles, achatsActuelsResult, ventesPrecedentes, achatsPrecedentsResult] = await Promise.all([
      prisma.vente.aggregate({
        where: {
          date: { gte: deb, lte: fin },
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        },
        _sum: { montantTotal: true, montantPaye: true },
        _count: { id: true },
      }),
      prisma.achat.aggregate({
        where: {
          date: { gte: deb, lte: fin },
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        },
        _sum: { montantTotal: true, fraisApproche: true },
      }),
      prisma.vente.aggregate({
        where: {
          date: { gte: debPrecedent, lte: finPrecedent },
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        },
        _sum: { montantTotal: true, montantPaye: true },
        _count: { id: true },
      }),
      prisma.achat.aggregate({
        where: {
          date: { gte: debPrecedent, lte: finPrecedent },
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        },
        _sum: { montantTotal: true, fraisApproche: true },
      }),
    ])

    const caActuel = Number(ventesActuelles._sum.montantTotal || 0)
    const caEncaisseActuel = Number(ventesActuelles._sum.montantPaye || 0)
    const montantAchatsActuels = Number(achatsActuelsResult._sum.montantTotal || 0) + Number(achatsActuelsResult._sum.fraisApproche || 0)
    const ventesActuellesCount = ventesActuelles._count.id || 0

    const caPrecedent = Number(ventesPrecedentes._sum.montantTotal || 0)
    const caEncaissePrecedent = Number(ventesPrecedentes._sum.montantPaye || 0)
    const montantAchatsPrecedents = Number(achatsPrecedentsResult._sum.montantTotal || 0) + Number(achatsPrecedentsResult._sum.fraisApproche || 0)
    const ventesPrecedentesCount = ventesPrecedentes._count.id || 0

    const evolutionCA = caActuel - caPrecedent
    const evolutionAchats = montantAchatsActuels - montantAchatsPrecedents
    const evolutionVentes = ventesActuellesCount - ventesPrecedentesCount

    const evolutionCAPourcent = caPrecedent > 0 ? ((evolutionCA / caPrecedent) * 100) : (caActuel > 0 ? 100 : 0)
    const evolutionAchatsPourcent = montantAchatsPrecedents > 0 ? ((evolutionAchats / montantAchatsPrecedents) * 100) : (montantAchatsActuels > 0 ? 100 : 0)
    const evolutionVentesPourcent = ventesPrecedentesCount > 0 ? ((evolutionVentes / ventesPrecedentesCount) * 100) : (ventesActuellesCount > 0 ? 100 : 0)

    comparaison = {
      periodeActuelle: {
        ca: caActuel,
        caEncaisse: caEncaisseActuel,
        achats: montantAchatsActuels,
        ventes: ventesActuellesCount,
      },
      periodePrecedente: {
        ca: caPrecedent,
        caEncaisse: caEncaissePrecedent,
        achats: montantAchatsPrecedents,
        ventes: ventesPrecedentesCount,
      },
      evolution: {
        ca: evolutionCA,
        achats: evolutionAchats,
        ventes: evolutionVentes,
      },
      evolutionPourcent: {
        ca: evolutionCAPourcent,
        achats: evolutionAchatsPourcent,
        ventes: evolutionVentesPourcent,
      },
    }
  }

  // 6. Top 10 Clients (Nouveau) - Calcul
  const topClientsRaw = await prisma.vente.groupBy({
    by: ['clientId', 'clientLibre'],
    where: {
      date: deb && fin ? { gte: deb, lte: fin } : undefined,
      statut: { in: ['VALIDE', 'VALIDEE'] },
      ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
      ...(magasinId ? { magasinId: Number(magasinId) } : {}),
    },
    _sum: { montantTotal: true },
    orderBy: { _sum: { montantTotal: 'desc' } },
    take: 10
  })

  topClients = await Promise.all(topClientsRaw.map(async (c: any) => {
    let nom = c.clientLibre || 'Client Divers'
    let telephone = ''
    if (c.clientId) {
      const client = await prisma.client.findUnique({ where: { id: c.clientId }, select: { nom: true, telephone: true } })
      if (client) {
        nom = client.nom
        telephone = client.telephone || ''
      }
    }
    return {
      nom,
      telephone,
      ca: Number(c._sum.montantTotal || 0)
    }
  }))

  return NextResponse.json({
    alertes,
    alertesPagination: {
      page: alertesPage,
      limit: alertesLimit,
      total: alertesTotal,
      totalPages: Math.ceil(alertesTotal / alertesLimit),
    },
    topProduits: topProduitsAll.slice(topSkip, topSkip + topLimit),
    topPagination: {
      page: topPage,
      limit: topLimit,
      total: topProduitsTotal,
      totalPages: Math.ceil(topProduitsTotal / topLimit),
    },
    mouvements,
    comparaison,
    topClients,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
