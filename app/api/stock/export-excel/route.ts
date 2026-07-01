import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'stocks:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()
    const search = request.nextUrl.searchParams.get('search')?.trim() || ''
    const categorie = request.nextUrl.searchParams.get('categorie')
    
    if (!magasinId) {
      return NextResponse.json({ error: 'Magasin requis' }, { status: 400 })
    }

    const m = Number(magasinId)
    if (!Number.isInteger(m) || m <= 0) {
      return NextResponse.json({ error: 'Magasin invalide' }, { status: 400 })
    }

    const searchConditions = search ? {
      OR: [
        { designation: { contains: search } },
        { code: { contains: search } }
      ]
    } : {}
    const categorieCondition = categorie && categorie !== 'TOUT' ? { categorie } : {}

    const [tousProduits, stocksExistants, magasin] = await Promise.all([
      prisma.produit.findMany({
        where: { actif: true, entiteId, ...searchConditions, ...categorieCondition },
        select: { id: true, code: true, designation: true, categorie: true, prixAchat: true, pamp: true },
        orderBy: { code: 'asc' },
      }),
      prisma.stock.findMany({
        where: { magasinId: m },
        select: {
          id: true,
          produitId: true,
          quantite: true,
        },
      }),
      prisma.magasin.findUnique({
        where: { id: m },
        select: { code: true, nom: true },
      })
    ])

    if (!magasin) {
      return NextResponse.json({ error: 'Magasin introuvable' }, { status: 404 })
    }

    const stocksMap = new Map(stocksExistants.map(s => [s.produitId, s]))

    const rows: any[] = []
    let totalQte = 0
    let totalValeur = 0

    for (const p of tousProduits) {
      const stock = stocksMap.get(p.id)
      const qte = stock?.quantite || 0
      const pamp = p.pamp && p.pamp > 0 ? p.pamp : (p.prixAchat || 0)
      const valeur = pamp * qte

      totalQte += qte
      totalValeur += valeur

      rows.push({
        Code: p.code,
        Désignation: p.designation,
        Catégorie: p.categorie,
        Magasin: `${magasin.code} - ${magasin.nom}`,
        Quantité: qte,
        PAMP: pamp,
        Valeur: valeur,
      })
    }

    if (rows.length > 0) {
      rows.push({
        Code: 'TOTAL',
        Désignation: '',
        Catégorie: '',
        Magasin: '',
        Quantité: totalQte,
        PAMP: '',
        Valeur: totalValeur,
      })
    }

    const buf = await rowsToBuffer(rows as any[], 'Stock')
    const filename = `stock-${magasin.code}-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/stock/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
