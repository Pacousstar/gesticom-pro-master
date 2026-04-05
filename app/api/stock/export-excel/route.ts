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

    const [tousProduits, stocksExistants] = await Promise.all([
      prisma.produit.findMany({
        where: { actif: true },
        select: { id: true, code: true, designation: true, categorie: true, seuilMin: true, prixAchat: true, prixVente: true },
        orderBy: { code: 'asc' },
      }),
      prisma.stock.findMany({
        where: { magasinId: m },
        select: {
          id: true,
          produitId: true,
          quantite: true,
          quantiteInitiale: true,
        },
      }),
    ])

    const magasin = await prisma.magasin.findUnique({
      where: { id: m },
      select: { code: true, nom: true },
    })

    if (!magasin) {
      return NextResponse.json({ error: 'Magasin introuvable' }, { status: 404 })
    }

    const stocksMap = new Map(stocksExistants.map(s => [s.produitId, s]))

    const data = tousProduits.map((produit) => {
      const stock = stocksMap.get(produit.id)
      const quantite = stock?.quantite || 0
      const alerte = quantite <= produit.seuilMin ? 'OUI' : 'NON'
      return {
        Code: produit.code,
        Désignation: produit.designation,
        Catégorie: produit.categorie,
        'Quantité actuelle': quantite,
        'Quantité initiale': stock?.quantiteInitiale || 0,
        'Seuil minimum': produit.seuilMin,
        'Prix achat': produit.prixAchat || 0,
        'Prix vente': produit.prixVente || 0,
        'Alerte stock': alerte,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Stock ${magasin.code}`)

    const colWidths = [
      { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
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
