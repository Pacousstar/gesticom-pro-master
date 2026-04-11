import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return forbidden

  const magasinId = request.nextUrl.searchParams.get('magasinId')
  const produitId = request.nextUrl.searchParams.get('produitId')
  const entiteId = await getEntiteId(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    where.entiteId = entiteId
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
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(50000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

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

      const whereProduit: any = { entiteId: where.entiteId } // Filtrer par entité (inclut archivés avec stock)
      const [tousProduits, stocksExistants, total] = await Promise.all([
        prisma.produit.findMany({
          where: whereProduit,
          select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, prixVente: true, prixMinimum: true },
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
      const whereProduit: any = { entiteId: where.entiteId }
      // Récupérer tous les produits
      const [tousProduits, tousStocks, total] = await Promise.all([
        prisma.produit.findMany({
          where: whereProduit,
          select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, prixVente: true, prixMinimum: true },
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
  const [stocks, total] = await Promise.all([
    prisma.stock.findMany({
      where: where,
      include: {
        produit: { select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, prixVente: true, prixMinimum: true } },
        magasin: { select: { id: true, code: true, nom: true } },
      },
      orderBy: [{ magasin: { code: 'asc' } }, { produit: { code: 'asc' } }],
      skip,
      take: limit,
    }),
    prisma.stock.count({
      where: where,
    }),
  ])

  return NextResponse.json({
    data: stocks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
