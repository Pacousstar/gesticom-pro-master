import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return forbidden

  const magasinId = request.nextUrl.searchParams.get('magasinId')
  const produitId = request.nextUrl.searchParams.get('produitId')
  const entiteIdFilter = await getEntiteIdOrAll(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }

  if (magasinId) {
    const m = Number(magasinId)
    if (Number.isInteger(m)) where.magasinId = m
  }
  if (produitId) {
    const p = Number(produitId)
    if (Number.isInteger(p)) where.produitId = p
  }

  const complet = request.nextUrl.searchParams.get('complet') === '1'
  const search = request.nextUrl.searchParams.get('search')?.trim() || ''
  const categorie = request.nextUrl.searchParams.get('categorie')
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit
  const exportAll = request.nextUrl.searchParams.get('export') === 'all'

  // Recherche et filtre catégorie pour les produits
  const searchConditions = search ? {
    OR: [
      { designation: { contains: search } },
      { code: { contains: search } }
    ]
  } : {}

  const categorieCondition = categorie && categorie !== 'TOUT' ? { categorie } : {}

  if (complet) {
    // Mode complet : retourner tous les produits (pagination côté client)
    // Retourner TOUS les produits avec leurs stocks (ou null si pas de stock)
    // Si un magasinId est spécifié, on affiche tous les produits avec leur stock dans ce magasin
    // Sinon, on affiche tous les produits avec leur stock dans leur magasin d'origine

    if (magasinId) {
      // Cas 1: Magasin spécifié - Afficher tous les produits avec leur stock dans ce magasin
      const m = Number(magasinId)
      if (!Number.isInteger(m)) {
        return NextResponse.json({ error: 'Magasin invalide' }, { status: 400 })
      }

      const whereProduit: any = { entiteId: where.entiteId, ...searchConditions, ...categorieCondition } // Filtrer par entité (inclut archivés avec stock)
      const [tousProduits, stocksExistants, total] = await Promise.all([
        prisma.produit.findMany({
          where: whereProduit,
          select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, pamp: true, prixVente: true, prixMinimum: true },
          orderBy: { code: 'asc' },
        }),
        prisma.stock.findMany({
          where: { magasinId: m, entiteId: where.entiteId }, // Filtrer par entité
          select: {
            id: true,
            produitId: true,
            quantite: true,
            quantiteInitiale: true,
            createdAt: true,
          },
        }),
        prisma.produit.count({ where: whereProduit }),
      ])

      const stocksMap = new Map(stocksExistants.map(s => [s.produitId, s]))

      // Récupérer le magasin
      const magasin = await prisma.magasin.findUnique({
        where: { id: m },
        select: { id: true, code: true, nom: true },
      })

      if (!magasin) {
        return NextResponse.json({ error: 'Magasin introuvable' }, { status: 404 })
      }

      // Construire la liste avec tous les produits
      const out = tousProduits.map((produit) => {
        const stock = stocksMap.get(produit.id)
        return {
          id: stock?.id || null,
          quantite: stock?.quantite || 0,
          quantiteInitiale: stock?.quantiteInitiale || 0,
          createdAt: stock?.createdAt ? stock.createdAt.toISOString() : undefined,
          produit,
          magasin,
        }
      })

      // Mode complet : retourner tous les produits (pagination côté client)
      return NextResponse.json(out, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    } else {
      // Cas 2: Pas de magasin spécifié - Afficher tous les produits avec leur stock dans leur magasin d'origine
      const whereProduit: any = { entiteId: where.entiteId, ...searchConditions, ...categorieCondition }
      // Récupérer tous les produits
      const [tousProduits, tousStocks, total] = await Promise.all([
        prisma.produit.findMany({
          where: whereProduit,
          select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, pamp: true, prixVente: true, prixMinimum: true },
          orderBy: { code: 'asc' },
        }),
        prisma.stock.findMany({
          where: { entiteId: where.entiteId }, // Filtrer par entité
          include: {
            magasin: {
              select: { id: true, code: true, nom: true },
            },
          },
        }),
        prisma.produit.count({ where: whereProduit }),
      ])

      // Créer un map: produitId -> stock (un produit ne peut avoir qu'un seul stock)
      const stocksMap = new Map(tousStocks.map(s => [s.produitId, s]))

      // Récupérer le premier magasin de l'entité par défaut
      const premierMagasin = await prisma.magasin.findFirst({
        where: { entiteId: where.entiteId },
        select: { id: true, code: true, nom: true },
        orderBy: { code: 'asc' },
      })
      const magasinDefaut = premierMagasin || { id: 0, code: 'N/A', nom: 'Non défini' }

      // Construire la liste avec tous les produits
      const out = tousProduits.map((produit) => {
        const stock = stocksMap.get(produit.id)
        if (stock) {
          return {
            id: stock.id,
            quantite: stock.quantite,
            quantiteInitiale: stock.quantiteInitiale,
            createdAt: stock.createdAt ? stock.createdAt.toISOString() : undefined,
            produit,
            magasin: stock.magasin,
          }
        } else {
          // Produit sans stock - utiliser le magasin par défaut
          return {
            id: null,
            quantite: 0,
            quantiteInitiale: 0,
            createdAt: undefined,
            produit,
            magasin: magasinDefaut,
          }
        }
      })

      // Mode complet : retourner tous les produits (pagination côté client)
      return NextResponse.json(out, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    }
  }

  // Cas sans complet: retourner les stocks avec pagination
  // Ajouter filtre produit
  if (search || categorieCondition.categorie) {
    where.produit = { ...searchConditions, ...categorieCondition }
  }

  const [stocks, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      include: {
        produit: { select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, prixVente: true, prixMinimum: true } },
        magasin: { select: { id: true, code: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: exportAll ? 0 : skip,
      take: exportAll ? undefined : limit,
    }),
    exportAll ? Promise.resolve(0) : prisma.stock.count({ where }),
  ])

  // Calcul des totaux pour export
  let totalQuantite = 0
  let totalValeur = 0
  if (exportAll || request.nextUrl.searchParams.get('includeTotals') === 'true') {
    const allStocks = await prisma.stock.findMany({
      where,
      include: {
        produit: { select: { pamp: true, prixAchat: true } }
      }
    })
    allStocks.forEach((s: any) => {
      totalQuantite += s.quantite || 0
      // Formule: Si pamp > 0, utiliser pamp. Sinon utiliser prixAchat (ou 0)
      const prix = (s.produit?.pamp && s.produit.pamp > 0) ? s.produit.pamp : (s.produit?.prixAchat || 0)
      totalValeur += (s.quantite || 0) * prix
    })
  }

  const response: any = {
    data: stocks,
    ...(exportAll ? {} : {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  }

  if (exportAll || request.nextUrl.searchParams.get('includeTotals') === 'true') {
    response.totals = {
      totalQuantite: Math.round(totalQuantite),
      totalValeur: Math.round(totalValeur)
    }
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
