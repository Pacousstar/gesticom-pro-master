import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()
    
    if (!magasinId) {
      return NextResponse.json({ error: 'Magasin requis' }, { status: 400 })
    }

    const m = Number(magasinId)
    if (!Number.isInteger(m) || m <= 0) {
      return NextResponse.json({ error: 'Magasin invalide' }, { status: 400 })
    }

    const [tousProduits, stocksExistants, magasin] = await Promise.all([
      prisma.produit.findMany({
        where: { actif: true },
        select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, pamp: true },
        orderBy: { code: 'asc' },
      }),
      prisma.stock.findMany({
        where: { magasinId: m },
        select: {
          id: true,
          produitId: true,
          quantite: true,
          quantiteInitiale: true,
          createdAt: true,
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
    let index = 1

    for (const p of tousProduits) {
      const stock = stocksMap.get(p.id)
      const qte = stock?.quantite || 0
      totalQte += qte

      rows.push({
        'N°': index++,
        Magasin: `${magasin.code} - ${magasin.nom}`,
        Code: p.code,
        Désignation: p.designation,
        'P.A (Init)': p.prixAchat || 0,
        'PAMP (Pro)': p.pamp || 0,
        Qté: qte,
        'Qté init.': stock?.quantiteInitiale || 0,
        Seuil: p.seuilMin,
        'Date entrée': stock?.createdAt ? new Date(stock.createdAt).toISOString().slice(0, 10) : '—',
      })
    }

    if (rows.length > 0) {
      rows.push({
        'N°': 'TOTAL',
        Magasin: '',
        Code: '',
        Désignation: '',
        'P.A (Init)': '',
        'PAMP (Pro)': '',
        Qté: totalQte,
        'Qté init.': '',
        Seuil: '',
        'Date entrée': '',
      })
    }

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N°': '', Magasin: '', Code: '', Désignation: '', 'P.A (Init)': '', 'PAMP (Pro)': '', Qté: '', 'Qté init.': '', Seuil: '', 'Date entrée': '' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Stock ${magasin.code}`)

    const colWidths = [
      { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `stock-${magasin.code}-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/stock/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
