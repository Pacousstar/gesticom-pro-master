import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getEntiteId } from '@/lib/get-entite-id'

const DASHBOARD_TIMEOUT_MS = 20000

function timeoutPromise<T>(ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
}

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

export async function GET() {
    let startTime = 0;
    try {
      const session = await getSession()
      if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
      startTime = Date.now();
    console.log('[API] GET /api/dashboard - Début');

    const now = new Date()
    const debAuj = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const finAuj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const debHier = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const finHier = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)

    const catchZero = (label: string) => (err: unknown) => {
      console.error('[dashboard]', label, err instanceof Error ? err.message : err)
      return 0
    }
    const catchEmpty = (label: string) => (err: unknown) => {
      console.error('[dashboard]', label, err instanceof Error ? err.message : err)
      return [] as never[]
    }

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)
    const entiteFilter = entiteId ? { entiteId } : {}

    const queries = Promise.all([
      // 0 - Transactions du jour
      prisma.vente.count({ where: { date: { gte: debAuj, lte: finAuj }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter } }).catch(catchZero('vente.count')),
      // 1 - Mouvements du jour
      prisma.mouvement.count({ where: { date: { gte: debAuj, lte: finAuj }, ...entiteFilter } }).catch(catchZero('mouvement.count')),
      // 2 - Clients actifs
      prisma.client.count({ where: { actif: true, ...entiteFilter } }).catch(catchZero('Client')),
      // 3 - Produits en stock
      prisma.stock.count({ where: { quantite: { gt: 0 }, magasin: entiteFilter } }).catch(catchZero('stock.count')),
      // 4 - Total produits catalogue
      prisma.produit.count({ where: { actif: true, ...entiteFilter } }).catch(catchZero('produit.count')),
      // 5 - Stocks faibles
      prisma.$queryRaw<Array<{
        id: number
        quantite: number
        produit_designation: string
        produit_seuilMin: number
        produit_categorie: string
        magasin_code: string
      }>>`
        SELECT 
          s.id,
          s.quantite,
          p.designation as produit_designation,
          p."seuilMin" as produit_seuilMin,
          p.categorie as produit_categorie,
          m.code as magasin_code
        FROM "Stock" s
        INNER JOIN "Produit" p ON s."produitId" = p.id
        INNER JOIN "Magasin" m ON s."magasinId" = m.id
        WHERE p.actif = 1 AND s.quantite < p."seuilMin"
        ${entiteId ? Prisma.sql`AND m."entiteId" = ${entiteId}` : Prisma.sql` `}
        ORDER BY s.quantite ASC
        LIMIT 5
      `.then((rows: any[]) => rows.map((r: any) => ({
        id: r.id,
        quantite: r.quantite,
        produit: {
          designation: r.produit_designation,
          seuilMin: r.produit_seuilMin,
          categorie: r.produit_categorie,
        },
        magasin: {
          code: r.magasin_code,
        },
      }))).catch(catchEmpty('stock.findMany')),
      // 6 - Ventes récentes avec montants
      prisma.vente.findMany({
        where: entiteFilter,
        take: 5,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          numero: true,
          date: true,
          montantTotal: true,
          clientLibre: true,
          client: { select: { nom: true } },
        },
      }).catch(catchEmpty('vente.findMany')),
      // 7 - Répartition par catégorie
      prisma.produit.groupBy({
        by: ['categorie'],
        where: { actif: true, ...entiteFilter },
        _count: { id: true },
      }).catch(catchEmpty('produit.groupBy')),
      // 8 - CA total (toutes périodes pour le calcul du panier moyen globale ou filtré)
      prisma.vente.aggregate({
        where: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter },
        _sum: { montantTotal: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { montantTotal: 0 }, _count: { id: 0 } })),
      // 9 - Top 5 Produits les plus vendus (CA)
      prisma.venteLigne.groupBy({
        by: ['produitId', 'designation'],
        where: { vente: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter } },
        _sum: { montant: true, quantite: true },
        orderBy: { _sum: { montant: 'desc' } },
        take: 5
      }).catch(catchEmpty('venteLigne.groupBy')),
      // 10 - Valeur totale du stock au prix de vente
      prisma.stock.findMany({
        where: { quantite: { gt: 0 }, magasin: entiteFilter },
        select: {
          quantite: true,
          produit: { select: { prixVente: true, prixAchat: true, pamp: true } }
        }
      }).catch(catchEmpty('stock.findMany.valeur')),
      // 11 - Statut Rupture (Nombre de produits à 0 stock)
      prisma.produit.count({
        where: {
          actif: true,
          stocks: { some: { quantite: { lte: 0 }, magasin: entiteFilter } }
        }
      }).catch(catchZero('produit.count.rupture')),
      // 12 - CA du jour (pour KPI direct)
      prisma.vente.aggregate({
        where: { date: { gte: debAuj, lte: finAuj }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter },
        _sum: { montantTotal: true }
      }).then((r: any) => toNum(r._sum.montantTotal)).catch(catchZero('vente.ca.auj')),
      // 13 - Transactions hier (pour comparaison)
      prisma.vente.count({ where: { date: { gte: debHier, lte: finHier }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter } }).catch(catchZero('vente.count.hier')),
      // 14 - CA du mois en cours
      prisma.vente.aggregate({
        where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter },
        _sum: { montantTotal: true }
      }).then((r: any) => toNum(r._sum.montantTotal)).catch(catchZero('vente.ca.mois')),
      // 15 - Dépenses Totales (Nombre et Montant)
      prisma.depense.aggregate({
        where: entiteFilter,
        _count: { id: true },
        _sum: { montant: true }
      }).catch(() => ({ _count: { id: 0 }, _sum: { montant: 0 } })),
    ])

    const timeoutFallback: any[] = [
      0, 0, 0, 0, 0,
      [] as any[], // lowStock
      [] as any[], // recentSales
      [] as any[], // categories
      { _sum: { montantTotal: 0 }, _count: { id: 0 } }, // caTotalAgg
      [] as any[], // topProduitsRaw
      [] as any[], // stocksValeurRaw
      0, // nbRuptures
      0, // caJour
      0, // transactionsHier
      0, // caMois
      { _count: { id: 0 }, _sum: { montant: 0 } }, // depensesAgg
    ]

    const result = await Promise.race([
      queries,
      timeoutPromise(DASHBOARD_TIMEOUT_MS, timeoutFallback),
    ]) as any[]

    const [
      transactionsJour,
      mouvementsJour,
      clientsActifs,
      stocksAvecQte,
      totalProduitsCatalogue,
      lowStock,
      recentSales,
      categories,
      caTotalAgg,
      topProduitsRaw,
      stocksValeurRaw,
      nbRuptures,
      caJour,
      transactionsHier,
      caMois,
      depensesAgg,
    ] = result

    const timedOut = result === timeoutFallback
    if (timedOut) {
      console.warn('[dashboard] Timeout après', DASHBOARD_TIMEOUT_MS, 'ms. Base verrouillée ou trop lente. Fermez le portable (Lancer.bat) si ouvert.')
    }

    const totalRef = categories.reduce((s: number, c: any) => s + (c._count?.id ?? 0), 0)
    const repartition = totalRef > 0
      ? categories.map((c: any) => ({ name: c.categorie || 'DIVERS', percent: Math.round(((c._count?.id ?? 0) / totalRef) * 100) })).sort((a: any, b: any) => b.percent - a.percent)
      : []

    // Calculs ERP supplémentaires
    const caTotalGlobal = toNum(caTotalAgg._sum?.montantTotal)
    const nbVentesGlobal = toNum(caTotalAgg._count?.id)
    const panierMoyen = nbVentesGlobal > 0 ? Math.round(caTotalGlobal / nbVentesGlobal) : 0

    const valeurStockTotal = stocksValeurRaw.reduce((sum: number, s: any) => {
      const prixRevient = s.produit?.pamp && s.produit?.pamp > 0 ? s.produit.pamp : (s.produit?.prixAchat ?? 0)
      return sum + (s.quantite * prixRevient)
    }, 0)
    const valeurStockVente = stocksValeurRaw.reduce((sum: number, s: any) => sum + (s.quantite * (s.produit?.prixVente ?? 0)), 0)

    const topProduits = topProduitsRaw.map((t: any) => ({
      name: t.designation || 'Inconnu',
      ca: toNum(t._sum?.montant),
      qte: toNum(t._sum?.quantite)
    }))

    const tauxRupture = totalProduitsCatalogue > 0 ? Math.round((nbRuptures / totalProduitsCatalogue) * 100) : 0

    // 1. Trésorerie Encaissée (Classe 5)
    const soldeCompte = await prisma.ecritureComptable.aggregate({
      where: {
        compte: { numero: { startsWith: '5' } },
        ...entiteFilter
      },
      _sum: { debit: true, credit: true }
    })
    const tresorerieReelle = toNum(soldeCompte._sum?.debit) - toNum(soldeCompte._sum?.credit)

    // 2. Dettes Fournisseurs (Achats non soldés)
    const dettesAgg = await prisma.achat.aggregate({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter },
      _sum: { montantTotal: true, montantPaye: true, fraisApproche: true }
    })
    const totalDettes = (toNum(dettesAgg._sum?.montantTotal) + toNum(dettesAgg._sum?.fraisApproche)) - toNum(dettesAgg._sum?.montantPaye)

    // 3. Créances Clients (Ventes non soldées)
    const creancesAgg = await prisma.vente.aggregate({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteFilter },
      _sum: { montantTotal: true, montantPaye: true }
    })
    const totalCreances = toNum(creancesAgg._sum?.montantTotal) - toNum(creancesAgg._sum?.montantPaye)

    return NextResponse.json({
      transactionsJour,
      transactionsHier,
      produitsEnStock: stocksAvecQte,
      totalProduitsCatalogue,
      mouvementsJour,
      clientsActifs,
      caJour,
      caMois,
      panierMoyen,
      valeurStockTotal,
      valeurStockVente,
      tresorerieReelle,
      totalDettes,
      totalCreances,
      tauxRupture,
      topProduits,
      lowStock: Array.isArray(lowStock) ? lowStock.map((s: any) => ({
        name: s.produit?.designation || '',
        stock: s.quantite || 0,
        min: s.produit?.seuilMin || 0,
        category: s.produit?.categorie || '',
      })) : [],
      recentSales: Array.isArray(recentSales) ? recentSales.map((v: any) => ({
        id: v.numero,
        client: v.client?.nom || v.clientLibre || '—',
        montant: toNum(v.montantTotal),
        time: v.date,
      })) : [],
      repartition,
      totalDepensesCount: toNum(depensesAgg?._count?.id),
      totalDepensesAmount: toNum(depensesAgg?._sum?.montant),
      _timeout: timedOut,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (e: any) {
    console.error('Dashboard API error:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      transactionsJour: 0,
      transactionsHier: 0,
      produitsEnStock: 0,
      totalProduitsCatalogue: 0,
      mouvementsJour: 0,
      clientsActifs: 0,
      caJour: 0,
      caHier: 0,
      soldeCaisse: 0,
      soldeBanque: 0,
      achatsJour: 0,
      lowStock: [],
      recentSales: [],
      repartition: [],
      _error: msg,
      _timeout: false,
    })
  } finally {
    // @ts-ignore
    if (typeof startTime !== 'undefined') {
      console.log(`[API] GET /api/dashboard - Fin (${Date.now() - startTime}ms)`);
    }
  }
}
