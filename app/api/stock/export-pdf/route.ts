import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

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
        select: { id: true, code: true, designation: true, categorie: true, seuilMin: true },
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
    ])

    const magasin = await prisma.magasin.findUnique({
      where: { id: m },
      select: { code: true, nom: true },
    })

    if (!magasin) {
      return NextResponse.json({ error: 'Magasin introuvable' }, { status: 404 })
    }

    const stocksMap = new Map(stocksExistants.map(s => [s.produitId, s]))

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Stock - ${magasin.code} - ${magasin.nom}`, 15, 20)
    doc.setFontSize(10)
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 15, 30)

    if (tousProduits.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucun produit en stock.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="stock-${magasin.code}-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    let y = 40
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Code', 15, y)
    doc.text('Désignation', 40, y)
    doc.text('Catégorie', 100, y)
    doc.text('Quantité', 140, y)
    doc.text('Seuil', 160, y)

    y += 5
    doc.line(15, y, 195, y)

    doc.setFont(undefined, 'normal')
    let totalProduits = 0
    let totalQuantite = 0

    for (const produit of tousProduits) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Code', 15, y)
        doc.text('Désignation', 40, y)
        doc.text('Catégorie', 100, y)
        doc.text('Quantité', 140, y)
        doc.text('Seuil', 160, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      totalProduits++
      const stock = stocksMap.get(produit.id)
      const quantite = stock?.quantite || 0
      totalQuantite += quantite

      doc.text(produit.code, 15, y)
      const designation = produit.designation.length > 25 ? produit.designation.substring(0, 22) + '...' : produit.designation
      doc.text(designation, 40, y)
      const categorie = produit.categorie.length > 12 ? produit.categorie.substring(0, 9) + '...' : produit.categorie
      doc.text(categorie, 100, y)
      doc.text(String(quantite), 140, y)
      doc.text(String(produit.seuilMin), 160, y)

      y += 7
    }

    y += 5
    doc.line(15, y, 195, y)
    y += 5
    doc.setFont(undefined, 'bold')
    doc.text(`Total produits: ${totalProduits}`, 15, y)
    doc.text(`Total quantité: ${totalQuantite}`, 100, y)

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="stock-${magasin.code}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/stock/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
