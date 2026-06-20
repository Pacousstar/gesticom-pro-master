import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'


import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return forbidden

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const produitId = searchParams.get('produitId')
  const magasinId = searchParams.get('magasinId')
  const type = searchParams.get('type')

  const entiteId = await getEntiteId(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
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

  if (dateDebut && dateFin) {
    try {
      const d1 = new Date(dateDebut + 'T00:00:00')
      const d2 = new Date(dateFin + 'T23:59:59')
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        where.date = { gte: d1, lte: d2 }
      }
    } catch {
      // Ignore les dates invalides: aucun filtre date appliqué.
    }
  }

  if (produitId && produitId !== 'TOUT') {
    const n = parseInt(produitId)
    if (!Number.isNaN(n)) where.produitId = n
  }
  if (magasinId && magasinId !== 'TOUT') {
    const n = parseInt(magasinId)
    if (!Number.isNaN(n)) where.magasinId = n
  }
  if (type && type !== 'TOUT') where.type = type

  try {
    const mouvements = await prisma.mouvement.findMany({
      where,
      take: 20000,
      include: {
        produit: { select: { designation: true, code: true, unite: true } },
        magasin: { select: { nom: true } },
        utilisateur: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows: any[] = mouvements.map((m, index) => ({
      'N°': index + 1,
      'Date Opération': m.dateOperation ? new Date(m.dateOperation).toLocaleString('fr-FR') : '—',
      'Code Produit': m.produit?.code || '—',
      'Désignation': m.produit?.designation || 'Inconnu',
      'Magasin': m.magasin?.nom || 'Inconnu',
      'Type': m.type,
      'Quantité': m.quantite,
      'Unité': m.produit?.unite || 'u',
      'Utilisateur': m.utilisateur?.nom || 'Système',
      'Observations': m.observation || '—',
    }))

    const totalQte = mouvements.reduce((s, m) => s + m.quantite, 0)
    if (rows.length > 0) {
      rows.push({ 'N°': '', 'Date Opération': '', 'Code Produit': '', 'Désignation': '', 'Magasin': '', 'Type': 'TOTAL', 'Quantité': totalQte, 'Unité': '', 'Utilisateur': '', 'Observations': '' })
    }

    const buf = await rowsToBuffer(rows as any[], 'Mouvements Stock')
    const filename = `mouvements-stock-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/rapports/inventaire/mouvements/export')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
