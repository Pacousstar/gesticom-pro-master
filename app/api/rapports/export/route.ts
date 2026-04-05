import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const hasDates = dateDebut && dateFin
  const deb = hasDates ? new Date(dateDebut + 'T00:00:00') : null
  const fin = hasDates ? new Date(dateFin + 'T23:59:59') : null

  const [stocks, topData, mouvements] = await Promise.all([
    prisma.stock.findMany({
      where: { produit: { actif: true } },
      include: {
        produit: { select: { id: true, code: true, designation: true, categorie: true, seuilMin: true } },
        magasin: { select: { id: true, code: true, nom: true } },
      },
    }),
    hasDates && deb && fin
      ? prisma.venteLigne.findMany({
          where: {
            vente: {
              date: { gte: deb, lte: fin },
              statut: 'VALIDEE',
            },
          },
          select: { produitId: true, quantite: true },
        })
      : prisma.venteLigne.groupBy({ by: ['produitId'], _sum: { quantite: true } }),
    prisma.mouvement.findMany({
      where: deb && fin ? { date: { gte: deb, lte: fin } } : undefined,
      take: 500,
      orderBy: { date: 'desc' },
      include: {
        produit: { select: { code: true, designation: true } },
        magasin: { select: { code: true, nom: true } },
      },
    }),
  ])

  const alertes = stocks
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

  let topProduits: Array<{ Code: string; Désignation: string; 'Quantité vendue': number }>
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
      where: { id: { in: ids } },
      select: { id: true, code: true, designation: true },
    })
    const prodMap = new Map(prods.map((p) => [p.id, p]))
    topProduits = sorted.map((g) => ({
      Code: prodMap.get(g.produitId)?.code ?? '',
      Désignation: prodMap.get(g.produitId)?.designation ?? '',
      'Quantité vendue': g._sum.quantite ?? 0,
    }))
  }

  const mouvementsRows = mouvements.map((m) => ({
    Date: m.date.toISOString().slice(0, 16),
    Type: m.type,
    'Code produit': m.produit?.code ?? '',
    Désignation: m.produit?.designation ?? '',
    Magasin: m.magasin ? `${m.magasin.code} - ${m.magasin.nom}` : '',
    Quantité: m.quantite,
    Observation: m.observation ?? '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertes.length ? alertes : [{ Code: '', Désignation: '', Catégorie: '', Magasin: '', Quantité: '', 'Seuil min': '', Manquant: '' }]), 'Alertes stock')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topProduits.length ? topProduits : [{ Code: '', Désignation: '', 'Quantité vendue': '' }]), 'Top produits')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mouvementsRows.length ? mouvementsRows : [{ Date: '', Type: '', 'Code produit': '', Désignation: '', Magasin: '', Quantité: '', Observation: '' }]), 'Mouvements')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `rapports_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
