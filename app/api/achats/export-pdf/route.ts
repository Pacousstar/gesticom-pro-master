import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const limit = Math.min(5000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 1000))
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const where: { date?: { gte: Date; lte: Date }; entiteId?: number } = {}
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }
    if (session.role !== 'SUPER_ADMIN') {
      where.entiteId = await getEntiteId(session)
    }

    const achats = await prisma.achat.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        fournisseur: { select: { nom: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
      },
    })

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7

    // En-tête
    doc.setFontSize(18)
    doc.text('Liste des Achats', margin, y)
    y += 10

    doc.setFontSize(10)
    const dateRange = dateDebut && dateFin 
      ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
      : 'Tous les achats'
    doc.text(dateRange, margin, y)
    y += 5
    doc.text(`Total : ${achats.length} achat(s)`, margin, y)
    y += 10

    // Tableau
    doc.setFontSize(9)
    const startY = y
    let currentY = startY

    // En-têtes du tableau
    doc.setFont(undefined, 'bold')
    doc.text('N°', margin, currentY)
    doc.text('Date', margin + 25, currentY)
    doc.text('Magasin', margin + 55, currentY)
    doc.text('Fournisseur', margin + 85, currentY)
    doc.text('Montant', margin + 130, currentY, { align: 'right' })
    doc.text('Paiement', margin + 160, currentY)
    currentY += lineHeight
    doc.line(margin, currentY - 2, 190, currentY - 2)

    doc.setFont(undefined, 'normal')
    for (const a of achats) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      const dateStr = new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const fournisseurStr = a.fournisseur?.nom || a.fournisseurLibre || '—'
      const montantStr = Number(a.montantTotal).toLocaleString('fr-FR') + ' F'

      doc.text(a.numero, margin, currentY)
      doc.text(dateStr, margin + 25, currentY)
      doc.text(a.magasin.code, margin + 55, currentY)
      doc.text(fournisseurStr.length > 20 ? fournisseurStr.substring(0, 20) + '...' : fournisseurStr, margin + 85, currentY)
      doc.text(montantStr, margin + 130, currentY, { align: 'right' })
      doc.text(a.modePaiement, margin + 160, currentY)

      currentY += lineHeight
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
        'Content-Disposition': `attachment; filename="achats-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF achats:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
