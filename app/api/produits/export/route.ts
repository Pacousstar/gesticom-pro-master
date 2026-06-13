import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const produits = await prisma.produit.findMany({
      where: { actif: true, entiteId },
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: { select: { id: true, magasinId: true, quantite: true } }
      },
      take: 10000,
    })

    const rows: any[] = []
    let totalStock = 0
    let totalValeurAchat = 0
    let totalValeurVente = 0

    for (const p of produits) {
      const stockActuel = p.stocks.reduce((sum: number, s: any) => sum + (s.quantite || 0), 0)
      const pamp = p.pamp && p.pamp > 0 ? p.pamp : (p.prixAchat || 0)
      const valeurAchat = pamp * stockActuel
      const valeurVente = (p.prixVente || 0) * stockActuel

      totalStock += stockActuel
      totalValeurAchat += valeurAchat
      totalValeurVente += valeurVente

      rows.push({
        Code: p.code,
        Désignation: p.designation,
        Catégorie: p.categorie,
        'Prix achat': p.prixAchat || 0,
        'PAMP': pamp,
        'Prix vente': p.prixVente || 0,
        'Prix Min.': p.prixMinimum || 0,
        'Stock Actuel': stockActuel,
        'Valeur Achat': valeurAchat,
        'Valeur Vente': valeurVente,
        'Date Création': p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
      })
    }

    if (rows.length > 0) {
      rows.push({
        Code: 'TOTAL',
        Désignation: '',
        Catégorie: '',
        'Prix achat': '',
        'PAMP': '',
        'Prix vente': '',
        'Prix Min.': '',
        'Stock Actuel': totalStock,
        'Valeur Achat': totalValeurAchat,
        'Valeur Vente': totalValeurVente,
        'Date Création': '',
      })
    }

    const buf = await rowsToBuffer(rows as any[], 'Produits')
    const filename = `produits_${new Date().toISOString().slice(0, 10)}.xlsx`
    return makeResponse(buf, filename)
  } catch (e) {
    console.error('GET /api/produits/export:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lors de l\'export Excel.' },
      { status: 500 }
    )
  }
}