import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

/**
 * API pour les statistiques graphiques
 * Retourne des données pour les graphiques (CA par période, évolution stock, top produits)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const periode = request.nextUrl.searchParams.get('periode') || '30' // 7, 30, 90, ou 'mois'
  const entiteIdFromSession = await getEntiteId(session)
  let entiteId = entiteIdFromSession

  // Support Super Admin override
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      entiteId = Number(entiteIdFromParams)
    }
  }

  const magasinId = request.nextUrl.searchParams.get('magasinId')

  try {
    const now = new Date()
    let dateDebut: Date
    let dateFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    if (periode === 'mois') {
      // Derniers 12 mois
      dateDebut = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0)
    } else {
      const jours = Number(periode) || 30
      dateDebut = new Date(now.getFullYear(), now.getMonth(), now.getDate() - jours, 0, 0, 0)
    }

    // Filtre par entité
    const whereVentes: any = {
      date: { gte: dateDebut, lte: dateFin },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    }
    const whereAchats: any = {
      date: { gte: dateDebut, lte: dateFin },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    }
    const whereMouvements: any = {
      date: { gte: dateDebut, lte: dateFin },
    }
    const whereFinance: any = {
      date: { gte: dateDebut, lte: dateFin },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    }

    if (entiteId) {
      whereVentes.entiteId = entiteId
      whereAchats.entiteId = entiteId
      whereMouvements.entiteId = entiteId
      whereFinance.entiteId = entiteId
    }
    if (magasinId) {
      whereVentes.magasinId = Number(magasinId)
      whereAchats.magasinId = Number(magasinId)
      whereMouvements.magasinId = Number(magasinId)
      whereFinance.magasinId = Number(magasinId)
    }

    // CA par période (Agrégation au lieu de fetch massif)
    const statsVentes = await prisma.vente.groupBy({
      by: ['date'],
      where: whereVentes,
      _sum: { montantTotal: true },
      _count: { id: true },
      orderBy: { date: 'asc' },
    })

    // Achats par période
    const statsAchats = await prisma.achat.groupBy({
      by: ['date'],
      where: whereAchats,
      _sum: { montantTotal: true },
      orderBy: { date: 'asc' },
    })

    // Charges et Dépenses (Sommes globales par jour)
    const statsCharges = await prisma.charge.groupBy({
      by: ['date'],
      where: whereFinance,
      _sum: { montant: true },
    })

    const statsDepenses = await prisma.depense.groupBy({
      by: ['date'],
      where: whereFinance,
      _sum: { montant: true },
    })

    // Top produits (par quantité vendue)
    const topProduits = await prisma.venteLigne.groupBy({
      by: ['produitId'],
      where: {
        vente: {
          date: { gte: dateDebut, lte: dateFin },
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...(entiteId ? { entiteId } : {}),
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        },
      },
      _sum: {
        quantite: true,
        montant: true,
      },
      orderBy: {
        _sum: {
          quantite: 'desc',
        },
      },
      take: 10,
    })

    // Récupérer les détails des produits
    const produitIds = topProduits.map((p: any) => p.produitId)
    const produitsDetails = await prisma.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, code: true, designation: true },
    })

    const topProduitsAvecDetails = topProduits.map((p: any) => {
      const produit = produitsDetails.find((pr: any) => pr.id === p.produitId)
      return {
        produitId: p.produitId,
        code: produit?.code || '—',
        designation: produit?.designation || '—',
        quantite: p._sum.quantite || 0,
        montant: p._sum.montant || 0,
      }
    })

    // Évolution stock (mouvements par jour)
    // Note: Pour le stock, on garde findMany car le groupement par type/date est plus complexe via groupBy simple
    const mouvements = await prisma.mouvement.findMany({
      where: whereMouvements,
      select: {
        date: true,
        type: true,
        quantite: true,
      },
      orderBy: { date: 'asc' },
      take: 5000,
    })

    // Grouper les données par jour ou mois
    const groupBy = periode === 'mois' ? 'mois' : 'jour'
    
    const caParPeriode: any[] = []
    const evolutionStock: any[] = []

    const caMap = new Map<string, { ca: number; achats: number; charges: number; count: number }>()
    const stockMap = new Map<string, { entrees: number; sorties: number }>()

    if (groupBy === 'mois') {
      statsVentes.forEach((v: any) => {
        const key = `${v.date.getFullYear()}-${String(v.date.getMonth() + 1).padStart(2, '0')}`
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.ca += Number(v._sum.montantTotal || 0)
        existing.count += v._count.id || 0
        caMap.set(key, existing)
      })

      statsAchats.forEach((a: any) => {
        const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.achats += Number(a._sum.montantTotal || 0)
        caMap.set(key, existing)
      })

      statsCharges.forEach((c: any) => {
        const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.charges += Number(c._sum.montant || 0)
        caMap.set(key, existing)
      })

      statsDepenses.forEach((d: any) => {
        const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.charges += Number(d._sum.montant || 0)
        caMap.set(key, existing)
      })

      mouvements.forEach((m: any) => {
        const key = `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`
        const existing = stockMap.get(key) || { entrees: 0, sorties: 0 }
        if (m.type === 'ENTREE') {
          existing.entrees += m.quantite
        } else {
          existing.sorties += m.quantite
        }
        stockMap.set(key, existing)
      })

      // Convertir en array trié
      Array.from(caMap.entries())
        .sort((a: [string, any], b: [string, any]) => a[0].localeCompare(b[0]))
        .forEach(([key, value]: [string, any]) => {
          caParPeriode.push({
            date: key,
            ca: value.ca,
            achats: value.achats,
            charges: value.charges,
            count: value.count || 0,
          })
        })

      Array.from(stockMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, value]) => {
          evolutionStock.push({
            date: key,
            entrees: value.entrees,
            sorties: value.sorties,
          })
        })
    } else {
      statsVentes.forEach((v: any) => {
        const key = v.date.toISOString().split('T')[0]
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.ca += Number(v._sum.montantTotal || 0)
        existing.count += v._count.id || 0
        caMap.set(key, existing)
      })

      statsAchats.forEach((a: any) => {
        const key = a.date.toISOString().split('T')[0]
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.achats += Number(a._sum.montantTotal || 0)
        caMap.set(key, existing)
      })

      statsCharges.forEach((c: any) => {
        const key = c.date.toISOString().split('T')[0]
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.charges += Number(c._sum.montant || 0)
        caMap.set(key, existing)
      })

      statsDepenses.forEach((d: any) => {
        const key = d.date.toISOString().split('T')[0]
        const existing = caMap.get(key) || { ca: 0, achats: 0, charges: 0, count: 0 }
        existing.charges += Number(d._sum.montant || 0)
        caMap.set(key, existing)
      })

      mouvements.forEach((m: any) => {
        const key = m.date.toISOString().split('T')[0]
        const existing = stockMap.get(key) || { entrees: 0, sorties: 0 }
        if (m.type === 'ENTREE') {
          existing.entrees += m.quantite
        } else {
          existing.sorties += m.quantite
        }
        stockMap.set(key, existing)
      })

      // Convertir en array trié
      Array.from(caMap.entries())
        .sort((a: [string, any], b: [string, any]) => a[0].localeCompare(b[0]))
        .forEach(([key, value]: [string, any]) => {
          caParPeriode.push({
            date: key,
            ca: value.ca,
            achats: value.achats,
            charges: value.charges,
            count: value.count || 0,
          })
        })

      Array.from(stockMap.entries())
        .sort((a: [string, any], b: [string, any]) => a[0].localeCompare(b[0]))
        .forEach(([key, value]: [string, any]) => {
          evolutionStock.push({
            date: key,
            entrees: value.entrees,
            sorties: value.sorties,
          })
        })
    }

    return NextResponse.json({
      caParPeriode,
      evolutionStock,
      topProduits: topProduitsAvecDetails,
      periode,
    })
  } catch (e) {
    console.error('Stats API error:', e)
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération des statistiques.',
        caParPeriode: [],
        evolutionStock: [],
        topProduits: [],
      },
      { status: 500 }
    )
  }
}
