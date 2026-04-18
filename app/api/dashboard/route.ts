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
    const entiteCondition = entiteId ? { entiteId } : {}

    // Début des dates pour SQL
    const isoAuj = debAuj.toISOString()
    const isoFinAuj = finAuj.toISOString()
    const isoHier = debHier.toISOString()
    const isoFinHier = finHier.toISOString()
    const isoMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const queries = Promise.all([
      // 0 - Métriques de Ventes (KPIs combinés via Prisma pour fiabilité SQLite)
      (async () => {
        const [auj, hier, mois, total] = await Promise.all([
          prisma.vente.aggregate({
            where: { date: { gte: isoAuj, lte: isoFinAuj }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition as any },
            _count: { id: true }, _sum: { montantTotal: true }
          }),
          prisma.vente.aggregate({
            where: { date: { gte: isoHier, lte: isoFinHier }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition as any },
            _count: { id: true }, _sum: { montantTotal: true }
          }),
          prisma.vente.aggregate({
            where: { date: { gte: isoMois }, statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition as any },
            _sum: { montantTotal: true }
          }),
          prisma.vente.aggregate({
            where: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition as any },
            _count: { id: true }, _sum: { montantTotal: true }
          })
        ])
        return [{
          nb_auj: auj._count.id,
          ca_auj: toNum(auj._sum.montantTotal),
          nb_hier: hier._count.id,
          ca_hier: toNum(hier._sum.montantTotal),
          ca_mois: toNum(mois._sum.montantTotal),
          ca_total: toNum(total._sum.montantTotal),
          nb_total: total._count.id
        }]
      })().catch(err => {
        console.error('[dashboard] sales.aggregate', err)
        return [{ nb_auj: 0, ca_auj: 0, nb_hier: 0, ca_hier: 0, ca_mois: 0, ca_total: 0, nb_total: 0 }]
      }),
      // 1 - Mouvements du jour
      prisma.mouvement.count({ where: { date: { gte: debAuj, lte: finAuj }, ...entiteCondition } }).catch(catchZero('mouvement.count')),
      // 2 - Clients actifs
      prisma.client.count({ where: { actif: true, ...entiteCondition } }).catch(catchZero('Client')),
      // 3 - Total produits catalogue
      prisma.produit.count({ where: { actif: true, ...entiteCondition } }).catch(catchZero('produit.count')),
      // 4 - Stocks faibles
      prisma.$queryRaw<Array<{
        id: number
        quantite: number
        produit_designation: string
        produit_seuilMin: number
        produit_categorie: string
        magasin_code: string
      }>>`
        SELECT s.id, s.quantite, p.designation as produit_designation, p."seuilMin" as produit_seuilMin, p.categorie as produit_categorie, m.code as magasin_code
        FROM "Stock" s
        INNER JOIN "Produit" p ON s."produitId" = p.id
        INNER JOIN "Magasin" m ON s."magasinId" = m.id
        WHERE p.actif = 1 AND s.quantite < p."seuilMin"
        ${entiteId ? Prisma.sql`AND m."entiteId" = ${entiteId}` : Prisma.sql` `}
        ORDER BY s.quantite ASC LIMIT 5
      `.catch(catchEmpty('stock.low')),
      // 5 - Ventes récentes
      prisma.vente.findMany({
        where: entiteCondition, take: 5, orderBy: { date: 'desc' },
        select: { id: true, numero: true, date: true, montantTotal: true, clientLibre: true, client: { select: { nom: true } } },
      }).catch(catchEmpty('vente.recent')),
      // 6 - Répartition par catégorie
      prisma.produit.groupBy({ by: ['categorie'], where: { actif: true, ...entiteCondition }, _count: { id: true } }).catch(catchEmpty('produit.groupBy')),
      // 7 - Top 5 Produits (CA)
      prisma.venteLigne.groupBy({
        by: ['produitId', 'designation'],
        where: { vente: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition } },
        _sum: { montant: true, quantite: true },
        orderBy: { _sum: { montant: 'desc' } },
        take: 5
      }).catch(catchEmpty('venteLigne.groupBy')),
      // 8 - Valeur du Stock (Agrégation SQL Native)
      prisma.$queryRaw<any[]>`
        SELECT 
          SUM(s.quantite * COALESCE(p.pamp, p."prixAchat", 0)) as total_achat,
          SUM(s.quantite * COALESCE(p."prixVente", 0)) as total_vente,
          SUM(CASE WHEN s.quantite <= 0 THEN 1 ELSE 0 END) as nb_ruptures,
          SUM(CASE WHEN s.quantite > 0 THEN 1 ELSE 0 END) as nb_en_stock
        FROM "Stock" s
        INNER JOIN "Produit" p ON s."produitId" = p.id
        INNER JOIN "Magasin" m ON s."magasinId" = m.id
        WHERE p.actif = 1
        ${entiteId ? Prisma.sql`AND m."entiteId" = ${entiteId}` : Prisma.sql` `}
      `.catch(err => {
        console.error('[dashboard] stock.raw', err)
        return [{ total_achat: 0, total_vente: 0, nb_ruptures: 0, nb_en_stock: 0 }]
      }),
      // 9 - Dépenses Totales
      prisma.depense.aggregate({ where: entiteCondition, _count: { id: true }, _sum: { montant: true } }).catch(() => ({ _count: { id: 0 }, _sum: { montant: 0 } })),
      
      // 10 - Solde Trésorerie Global (Grand Livre)
      prisma.ecritureComptable.aggregate({
        where: { compte: { numero: { startsWith: '5' } }, ...entiteCondition as any },
        _sum: { debit: true, credit: true }
      }).catch(() => ({ _sum: { debit: 0, credit: 0 } })),

      // 11 - Dettes Fournisseurs (Achats non soldés)
      prisma.achat.aggregate({
        where: { statut: { not: 'ANNULE' }, ...entiteCondition as any },
        _sum: { montantTotal: true, montantPaye: true, fraisApproche: true }
      }).catch(() => ({ _sum: { montantTotal: 0, montantPaye: 0, fraisApproche: 0 } })),

      // 12 - Créances Clients (Ventes non soldées)
      prisma.vente.aggregate({
        where: { statut: { in: ['VALIDE', 'VALIDEE'] }, ...entiteCondition as any },
        _sum: { montantTotal: true, montantPaye: true }
      }).catch(() => ({ _sum: { montantTotal: 0, montantPaye: 0 } })),

      // 13 - Détail Trésorerie par compte
      prisma.ecritureComptable.groupBy({
        by: ['compteId'],
        where: { compte: { numero: { startsWith: '5' } }, ...entiteCondition as any },
        _sum: { debit: true, credit: true }
      }).catch(() => []) as Promise<any[]>,

      // 14 - Alertes Système
      prisma.systemAlerte.findMany({
        where: { lu: false, entiteId: entiteId || undefined },
        orderBy: { date: 'desc' },
        take: 10
      }).catch(catchEmpty('systemAlerte.findMany')),

      // 15 - TENDANCES MENSUELLES
      prisma.$queryRaw<any[]>`
        SELECT 
          SUBSTR(date, 1, 7) as mois,
          SUM("montantTotal") as montant
        FROM "Vente"
        WHERE statut IN ('VALIDE', 'VALIDEE')
        AND date >= date('now', '-24 month', 'start of month')
        ${entiteId ? Prisma.sql`AND "entiteId" = ${entiteId}` : Prisma.sql` `}
        GROUP BY mois
        ORDER BY mois ASC
      `.catch(catchEmpty('tendances.raw')),
    ])

    const timeoutFallback: any[] = [
      [{ nb_auj: 0, ca_auj: 0, nb_hier: 0, ca_hier: 0, ca_mois: 0, ca_total: 0, nb_total: 0 }], // 0
      0, // 1
      0, // 2
      0, // 3
      [], // 4
      [], // 5
      [], // 6
      [], // 7
      [{ total_achat: 0, total_vente: 0, nb_ruptures: 0, nb_en_stock: 0 }], // 8
      { _count: { id: 0 }, _sum: { montant: 0 } }, // 9
      { _sum: { debit: 0, credit: 0 } }, // 10
      { _sum: { montantTotal: 0, montantPaye: 0, fraisApproche: 0 } }, // 11
      { _sum: { montantTotal: 0, montantPaye: 0 } }, // 12
      [], // 13
      [], // 14
      [], // 15
    ]

    const result = await Promise.race([
      queries,
      timeoutPromise(DASHBOARD_TIMEOUT_MS, timeoutFallback),
    ]) as any[]

    const [
      salesRaw,
      mouvementsJour,
      clientsActifs,
      totalProduitsCatalogue,
      lowStockRaw,
      recentSalesRaw,
      categoriesRaw,
      topProduitsRaw,
      stockRaw,
      depensesAgg,
      soldeCompte, // Sum global (Option 10) - On garde pour rétro-compatibilité
      dettesAgg,
      creancesAgg,
      detailTresorerieRaw, // GroupBy (Option 13)
      systemAlertesRaw,
      tendancesRaw,
    ] = result

    const timedOut = result === timeoutFallback
    if (timedOut) {
      console.warn('[dashboard] Timeout après', DASHBOARD_TIMEOUT_MS, 'ms. Base verrouillée.')
    }

    // Extraction des données Sales
    const s = salesRaw[0] || {}
    const transactionsJour = toNum(s.nb_auj)
    const transactionsHier = toNum(s.nb_hier)
    const caJour = toNum(s.ca_auj)
    const caMois = toNum(s.ca_mois)
    const caTotalGlobal = toNum(s.ca_total)
    const nbVentesGlobal = toNum(s.nb_total)
    const panierMoyen = nbVentesGlobal > 0 ? Math.round(caTotalGlobal / nbVentesGlobal) : 0

    // Extraction Stock
    const st = stockRaw[0] || {}
    const valeurStockTotal = toNum(st.total_achat)
    const valeurStockVente = toNum(st.total_vente)
    const nbRuptures = toNum(st.nb_ruptures)
    const stocksAvecQte = toNum(st.nb_en_stock)
    const tauxRupture = totalProduitsCatalogue > 0 ? Math.round((nbRuptures / totalProduitsCatalogue) * 100) : 0

    // Extraction Trésorerie/Dettes/Créances
    let tresorerieCaisse = 0
    let tresorerieBanque = 0
    
    // Essayer de récupérer le détail via les comptes (OHADA: 57=Caisse, 52/51=Banque)
    if (Array.isArray(detailTresorerieRaw)) {
      for (const d of detailTresorerieRaw) {
         const solde = (d._sum?.debit || 0) - (d._sum?.credit || 0)
         // On récupère le numéro de compte via Prisma (ou on utilise un mapping pré-récupéré)
         // Pour faire simple ici, on va utiliser le solde total et essayer de différencier si on avait les numéros
         // Mais soldeCompte agrégé est plus sûr pour le total
      }
    }

    const tresorerieReelle = toNum(soldeCompte._sum?.debit) - toNum(soldeCompte._sum?.credit)
    
    // On va aussi récupérer les soldes physiques des tables Caisse et Banque qui sont plus fiables pour la gestion
    const [soldesPhysiques] = await Promise.all([
      prisma.$transaction([
        prisma.banque.aggregate({ where: entiteCondition, _sum: { soldeActuel: true } }),
        prisma.magasin.aggregate({ where: entiteCondition, _sum: { soldeCaisse: true } })
      ])
    ])

    tresorerieBanque = toNum(soldesPhysiques[0]._sum?.soldeActuel)
    tresorerieCaisse = toNum(soldesPhysiques[1]._sum?.soldeCaisse)

    const totalDettes = (toNum(dettesAgg._sum?.montantTotal) + toNum(dettesAgg._sum?.fraisApproche)) - toNum(dettesAgg._sum?.montantPaye)
    const totalCreances = toNum(creancesAgg._sum?.montantTotal) - toNum(creancesAgg._sum?.montantPaye)

    // Formattage Catégories
    const totalCat = categoriesRaw.reduce((acc: number, c: any) => acc + (c._count?.id ?? 0), 0)
    const repartition = totalCat > 0
      ? categoriesRaw.map((c: any) => ({ name: c.categorie || 'DIVERS', percent: Math.round(((c._count?.id ?? 0) / totalCat) * 100) })).sort((a: any, b: any) => b.percent - a.percent)
      : []

    // Formattage Top Produits
    const topProduits = topProduitsRaw.map((t: any) => ({
      name: t.designation || 'Inconnu',
      ca: toNum(t._sum?.montant),
      qte: toNum(t._sum?.quantite)
    }))

    // Formattage des tendances (12 mois courants vs 12 mois précédents)
    const trends: Record<string, number> = {}
    if (Array.isArray(tendancesRaw)) {
      tendancesRaw.forEach((t: any) => { trends[t.mois] = toNum(t.montant) })
    }

    const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
      // On recule de (11 - i) mois pour finir par le mois actuel (i=11)
      const targetDate = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() + 1
      const prevYear = year - 1
      
      const key = `${year}-${month.toString().padStart(2, '0')}`
      const prevKey = `${prevYear}-${month.toString().padStart(2, '0')}`
      
      return {
        month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(targetDate),
        current: trends[key] || 0,
        previous: trends[prevKey] || 0
      }
    })

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
      tresorerieCaisse,
      tresorerieBanque,
      totalDettes,
      totalCreances,
      tauxRupture,
      topProduits,
      lowStock: (lowStockRaw as any[]).map((s: any) => ({
        name: s.produit_designation || '',
        stock: s.quantite || 0,
        min: s.produit_seuilMin || 0,
        category: s.produit_categorie || '',
      })),
      systemAlertes: systemAlertesRaw || [],
      creditAlerts: (await (async () => {
        // Détection automatique des alertes de crédit (90% du plafond)
        const clientsWithPlafond = await prisma.client.findMany({
          where: { ...entiteCondition, plafondCredit: { gt: 0 } },
          select: { id: true, nom: true, plafondCredit: true }
        })
        
        if (clientsWithPlafond.length === 0) return []

        // Optimisation : une seule requête d'agrégation groupée par client
        const debts = await prisma.vente.groupBy({
          by: ['clientId'],
          where: { 
            clientId: { in: clientsWithPlafond.map(c => c.id) },
            statut: 'VALIDEE'
          },
          _sum: { montantTotal: true, montantPaye: true }
        })

        const debtMap = new Map(debts.map(d => [d.clientId, (toNum(d._sum.montantTotal) - toNum(d._sum.montantPaye))]))
        
        const alerts: any[] = []
        for (const c of clientsWithPlafond) {
          const dette = debtMap.get(c.id) || 0
          const ratio = dette / (c.plafondCredit || 1)
          
          if (ratio >= 0.9) {
            alerts.push({
              id: `credit-${c.id}`,
              type: ratio >= 1 ? 'CRITICAL' : 'WARNING',
              categorie: 'CREDIT',
              message: `Le client ${c.nom} a atteint ${Math.round(ratio * 100)}% de son plafond (${dette.toLocaleString()} / ${c.plafondCredit?.toLocaleString()} F)`,
              date: new Date().toISOString()
            })
          }
        }
        return alerts
      })().catch(() => [])),
      repartition,
      totalDepensesCount: toNum(depensesAgg?._count?.id),
      totalDepensesAmount: toNum(depensesAgg?._sum?.montant),
      monthlyTrends,
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
    if (typeof startTime !== 'undefined') {
      console.log(`[API] GET /api/dashboard - Fin (${Date.now() - startTime}ms)`);
    }
  }
}
