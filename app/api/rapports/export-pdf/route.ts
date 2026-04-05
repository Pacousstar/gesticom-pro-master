import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const hasDates = dateDebut && dateFin
  const deb = hasDates ? new Date(dateDebut + 'T00:00:00') : null
  const fin = hasDates ? new Date(dateFin + 'T23:59:59') : null

  try {
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
        produit: `${s.produit.code} - ${s.produit.designation}`,
        magasin: `${s.magasin.code} - ${s.magasin.nom}`,
        stock: s.quantite,
        seuil: s.produit.seuilMin,
      }))

    const topProduits = topData.reduce((acc: Record<number, number>, l) => {
      const quantite = 'quantite' in l ? l.quantite : (l._sum?.quantite || 0)
      acc[l.produitId] = (acc[l.produitId] || 0) + quantite
      return acc
    }, {})

    const topProduitsList = Object.entries(topProduits)
      .map(([produitId, total]) => {
        const p = stocks.find((s) => s.produit.id === Number(produitId))?.produit
        return { produit: p ? `${p.code} - ${p.designation}` : `ID ${produitId}`, total: total as number }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    const doc = new jsPDF()
    const margin = 20
    const pageHeight = doc.internal.pageSize.height
    const lineHeight = 7
    let y = 20

    // En-tête
    doc.setFontSize(18)
    doc.text('Rapports GestiCom', margin, y)
    y += 10

    doc.setFontSize(10)
    const dateRange = hasDates 
      ? `Du ${new Date(dateDebut!).toLocaleDateString('fr-FR')} au ${new Date(dateFin!).toLocaleDateString('fr-FR')}`
      : 'Toutes périodes'
    doc.text(dateRange, margin, y)
    y += 10

    // Alertes Stock
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Alertes Stock (Rupture)', margin, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    if (alertes.length === 0) {
      doc.text('Aucune alerte', margin, y)
      y += lineHeight
    } else {
      doc.setFont(undefined, 'bold')
      doc.text('Produit', margin, y)
      doc.text('Magasin', margin + 80, y)
      doc.text('Stock', margin + 130, y, { align: 'right' })
      doc.text('Seuil', margin + 160, y, { align: 'right' })
      y += lineHeight
      doc.line(margin, y - 2, 190, y - 2)
      doc.setFont(undefined, 'normal')

      for (const a of alertes.slice(0, 30)) {
        if (y > pageHeight - 30) {
          doc.addPage()
          y = 20
        }
        doc.text(a.produit.length > 30 ? a.produit.substring(0, 30) + '...' : a.produit, margin, y)
        doc.text(a.magasin.length > 20 ? a.magasin.substring(0, 20) + '...' : a.magasin, margin + 80, y)
        doc.text(String(a.stock), margin + 130, y, { align: 'right' })
        doc.text(String(a.seuil), margin + 160, y, { align: 'right' })
        y += lineHeight
      }
    }

    y += 10

    // Top Produits
    if (y > pageHeight - 50) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Top Produits Vendus', margin, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    if (topProduitsList.length === 0) {
      doc.text('Aucune donnée', margin, y)
      y += lineHeight
    } else {
      doc.setFont(undefined, 'bold')
      doc.text('Produit', margin, y)
      doc.text('Quantité vendue', margin + 130, y, { align: 'right' })
      y += lineHeight
      doc.line(margin, y - 2, 190, y - 2)
      doc.setFont(undefined, 'normal')

      for (const t of topProduitsList) {
        if (y > pageHeight - 30) {
          doc.addPage()
          y = 20
        }
        doc.text(t.produit.length > 50 ? t.produit.substring(0, 50) + '...' : t.produit, margin, y)
        doc.text(String(t.total), margin + 130, y, { align: 'right' })
        y += lineHeight
      }
    }

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 190, pageHeight - 10, { align: 'right' })
      doc.text(`GestiCom - ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10)
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapports-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF rapports:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
