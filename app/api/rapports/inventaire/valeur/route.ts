import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const dateFin = searchParams.get('dateFin') || new Date().toISOString().split('T')[0]
  const magasinId = searchParams.get('magasinId')
  const search = searchParams.get('search')?.trim() || ''
  const categorie = searchParams.get('categorie')?.trim()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const exportAll = searchParams.get('export') === 'all'
  const includeTotals = searchParams.get('includeTotals') === 'true'

  try {
    const entiteId = await getEntiteId(session)
    const where: any = {}

    if (session.role === 'SUPER_ADMIN') {
      const entiteIdFromParams = searchParams.get('entiteId')?.trim()
      if (entiteIdFromParams) {
        where.entiteId = Number(entiteIdFromParams)
      } else if (entiteId > 0) {
        where.entiteId = entiteId
      }
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }

    if (!where.entiteId) return NextResponse.json({ error: 'Entité non définie.' }, { status: 400 })

    // Validation du magasinId
    let parsedMagasinId: number | undefined = undefined
    if (magasinId && magasinId !== 'TOUT') {
      const n = parseInt(magasinId)
      if (!Number.isNaN(n)) parsedMagasinId = n
    }

    // Construction du filtre produit
    const produitWhere: any = { actif: true, entiteId }
    if (search) {
      produitWhere.OR = [
        { designation: { contains: search } },
        { code: { contains: search } }
      ]
    }
    if (categorie && categorie !== 'TOUTE') {
      produitWhere.categorie = categorie
    }

    // Pour export, pas de limite
    const skip = exportAll ? 0 : (page - 1) * limit

    // 1. Récupérer les produits actifs avec pagination
    const [produits, totalProduits] = await Promise.all([
      prisma.produit.findMany({
        where: produitWhere,
        select: {
          id: true,
          designation: true,
          code: true,
          categorie: true,
          unite: true,
          pamp: true,
          prixAchat: true,
        },
        orderBy: { designation: 'asc' },
        skip,
        take: exportAll ? undefined : limit
      }),
      exportAll ? Promise.resolve(0) : prisma.produit.count({ where: produitWhere })
    ])

    // 2. Récupérer les stocks actuels
    const stocks = await prisma.stock.findMany({
      where: parsedMagasinId ? { magasinId: parsedMagasinId } : { entiteId },
      select: {
        produitId: true,
        quantite: true,
      }
    })

    // 3. Récupérer les mouvements POSTÉRIEURS à dateFin pour recalculer le stock à cette date
    // Stock à dateFin = StockActuel - Mouvements(Entrée, après dateFin) + Mouvements(Sortie, après dateFin)
    
    // Sécurisation de la date
    let dateLimit: Date;
    try {
      dateLimit = new Date(dateFin + 'T23:59:59');
      if (isNaN(dateLimit.getTime())) dateLimit = new Date();
    } catch {
      dateLimit = new Date();
    }

    const mouvementsPost = await prisma.mouvement.findMany({
      where: {
        entiteId,
        date: { gt: dateLimit },
        ...(parsedMagasinId ? { magasinId: parsedMagasinId } : {})
      },
      select: {
        produitId: true,
        type: true,
        quantite: true,
      }
    })

    const stockMap: Record<number, number> = {}
    stocks.forEach((s: any) => {
      stockMap[s.produitId] = (stockMap[s.produitId] || 0) + (s.quantite || 0)
    })

    // Ajustement inverse pour remonter dans le temps
    mouvementsPost.forEach((m: any) => {
      // Pour les mouvements postérieurs à la date:
      // - ENTREE / TRANSFERT_IN augmente le stock → Pour revenir en arrière, on soustrait
      // - SORTIE / TRANSFERT_OUT diminue le stock → Pour revenir en arrière, on ajoute
      // - AJUSTEMENT: quantite>0 augmente le stock → on soustrait; quantite<0 diminue → on ajoute
      if (m.type === 'ENTREE' || m.type === 'TRANSFERT_IN' || (m.type === 'AJUSTEMENT' && m.quantite > 0)) {
        stockMap[m.produitId] = (stockMap[m.produitId] || 0) - m.quantite
      } else if (m.type === 'SORTIE' || m.type === 'TRANSFERT_OUT' || (m.type === 'AJUSTEMENT' && m.quantite < 0)) {
        stockMap[m.produitId] = (stockMap[m.produitId] || 0) + Math.abs(m.quantite)
      }
    })

    const data = produits.map((p: any) => {
      const qte = stockMap[p.id] || 0
      // Formule: Si pamp > 0, utiliser pamp. Sinon utiliser prixAchat (ou 0)
      const prixValo = (p.pamp && p.pamp > 0) ? p.pamp : (p.prixAchat || 0)
      return {
        id: p.id,
        code: p.code,
        designation: p.designation,
        categorie: p.categorie,
        unite: p.unite,
        quantite: qte,
        pamp: prixValo,
        valeurTotal: qte * prixValo
      }
    }).filter((d: any) => exportAll || d.quantite !== 0)

    // Calcul des totaux
    let totalValeur = 0
    let totalQuantite = 0
    if (includeTotals || exportAll) {
      const allProduits = await prisma.produit.findMany({
        where: { actif: true, entiteId, ...(categorie && categorie !== 'TOUTE' ? { categorie } : {}) },
        select: { id: true, pamp: true, prixAchat: true }
      })
      allProduits.forEach((p: any) => {
        const qte = stockMap[p.id] || 0
        const prixValo = (p.pamp && p.pamp > 0) ? p.pamp : (p.prixAchat || 0)
        totalQuantite += qte
        totalValeur += qte * prixValo
      })
    }

    const response: any = { data }
    
    if (!exportAll) {
      response.pagination = {
        page,
        limit,
        total: totalProduits,
        totalPages: Math.ceil(totalProduits / limit)
      }
    }
    
    if (includeTotals || exportAll) {
      response.totals = {
        valeurTotal: Math.round(totalValeur),
        totalQuantite: Math.round(totalQuantite)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/rapports/inventaire/valeur:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
