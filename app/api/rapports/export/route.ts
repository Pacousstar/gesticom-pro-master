import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

import { multiSheetToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const hasDates = dateDebut && dateFin
  const deb = hasDates ? new Date(dateDebut + 'T00:00:00') : null
  const fin = hasDates ? new Date(dateFin + 'T23:59:59') : null

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

  const [stocks, topData, mouvements] = await Promise.all([
    prisma.stock.findMany({
      where: { ...where, produit: { actif: true } },
      take: 10000,
      include: {
        produit: { select: { id: true, code: true, designation: true, categorie: true, seuilMin: true } },
        magasin: { select: { id: true, code: true, nom: true } },
      },
    }),
    hasDates && deb && fin
      ? prisma.venteLigne.findMany({
          where: {
            vente: {
              ...where,
              date: { gte: deb, lte: fin },
              statut: { in: ['VALIDE', 'VALIDEE'] },
            },
          },
          take: 10000,
          select: { produitId: true, quantite: true },
        })
      : prisma.venteLigne.groupBy({ 
          by: ['produitId'], 
          where: where,
          _sum: { quantite: true } 
        }),
    prisma.mouvement.findMany({
      where: { ...where, ...(deb && fin ? { date: { gte: deb, lte: fin } } : {}) },
      take: 20000,
      orderBy: { date: 'desc' },
      include: {
        produit: { select: { code: true, designation: true } },
        magasin: { select: { code: true, nom: true } },
      },
    }),
  ])

  const alertes: any[] = stocks
    .filter((s) => s.quantite < s.produit.seuilMin)
    .map((s) => ({
      Code: s.produit.code,
      Désignation: s.produit.designation,
      Catégorie: s.produit.categorie,
      Magasin: s.magasin ? `${s.magasin.code} - ${s.magasin.nom}` : '',
      Quantité: s.quantite,
      'Seuil min': s.produit.seuilMin,
      Manquant: s.produit.seuilMin - s.quantite,
    }))

  let topProduits: any[]
  if (hasDates && Array.isArray(topData)) {
    const byId = new Map<number, number>()
    const lignes = topData as Array<{ produitId: number; quantite: number }>
    for (const l of lignes) {
      byId.set(l.produitId, (byId.get(l.produitId) ?? 0) + l.quantite)
    }
    const sorted = [...byId.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
    const ids = sorted.map(([id]) => id)
    const prods = await prisma.produit.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, designation: true },
    })
    const prodMap = new Map(prods.map((p) => [p.id, p]))
    topProduits = sorted.map(([produitId, q]) => ({
      Code: prodMap.get(produitId)?.code ?? '',
      Désignation: prodMap.get(produitId)?.designation ?? '',
      'Quantité vendue': q,
    }))
  } else {
    const topGroup = topData as Array<{ produitId: number; _sum: { quantite: number | null } }>
    const sorted = topGroup.sort((a, b) => (b._sum.quantite ?? 0) - (a._sum.quantite ?? 0)).slice(0, 50)
    const ids = sorted.map((x) => x.produitId)
    const prods = await prisma.produit.findMany({
      where: { id: { in: ids }, ...where },
      select: { id: true, code: true, designation: true },
    })
    const prodMap = new Map(prods.map((p) => [p.id, p]))
    topProduits = sorted.map((g) => ({
      Code: prodMap.get(g.produitId)?.code ?? '',
      Désignation: prodMap.get(g.produitId)?.designation ?? '',
      'Quantité vendue': g._sum.quantite ?? 0,
    }))
  }

  const mouvementsRows: any[] = mouvements.map((m) => ({
    Date: m.date.toISOString().slice(0, 16),
    Type: m.type,
    'Code produit': m.produit?.code ?? '',
    Désignation: m.produit?.designation ?? '',
    Magasin: m.magasin ? `${m.magasin.code} - ${m.magasin.nom}` : '',
    Quantité: m.quantite,
    Observation: m.observation ?? '',
  }))

  if (alertes.length > 0) {
    const totalAlertes = alertes.length
    alertes.push({ Code: '', Désignation: '', Catégorie: '', Magasin: '', Quantité: '', 'Seuil min': 'Total alertes', Manquant: totalAlertes })
  }
  if (topProduits.length > 0) {
    const totalVendue = topProduits.reduce((s: number, p: any) => s + p['Quantité vendue'], 0)
    topProduits.push({ Code: '', Désignation: '', 'Quantité vendue': totalVendue })
  }
  if (mouvementsRows.length > 0) {
    const totalQte = mouvementsRows.reduce((s: number, r: any) => s + r.Quantité, 0)
    mouvementsRows.push({ Date: '', Type: '', 'Code produit': '', Désignation: '', Magasin: '', Quantité: 'Total', Observation: totalQte })
  }

  const buf = await multiSheetToBuffer([
    { name: 'Alertes stock', rows: alertes.length ? alertes as any[] : [{ Code: '', Désignation: '', Catégorie: '', Magasin: '', Quantité: '', 'Seuil min': '', Manquant: '' }] },
    { name: 'Top produits', rows: topProduits.length ? topProduits as any[] : [{ Code: '', Désignation: '', 'Quantité vendue': '' }] },
    { name: 'Mouvements', rows: mouvementsRows.length ? mouvementsRows as any[] : [{ Date: '', Type: '', 'Code produit': '', Désignation: '', Magasin: '', Quantité: '', Observation: '' }] },
  ])
  const filename = `rapports_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return makeResponse(buf, filename)
}
