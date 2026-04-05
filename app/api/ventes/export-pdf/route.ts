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
    const where: { date?: { gte: Date; lte: Date }; statut?: string; entiteId?: number } = {}
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }
    where.statut = 'VALIDEE'
    if (session.role !== 'SUPER_ADMIN') {
      where.entiteId = await getEntiteId(session)
    }

    const ventes = await prisma.vente.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { nom: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
      },
    })

    const parametres = await prisma.parametre.findFirst()
    const nomEntreprise = parametres?.nomEntreprise || 'GESTICOM PRO'

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7

    // En-tête
    doc.setFontSize(18)
    doc.text(`Journal des Ventes - ${nomEntreprise}`, margin, y)
    y += 10

    doc.setFontSize(10)
    const dateRange = dateDebut && dateFin 
      ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
      : 'Toutes les ventes'
    doc.text(dateRange, margin, y)
    y += 5
    doc.text(`Total : ${ventes.length} vente(s)`, margin, y)
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
    doc.text('Client', margin + 85, currentY)
    doc.text('Montant', margin + 130, currentY, { align: 'right' })
    doc.text('Paiement', margin + 160, currentY)
    currentY += lineHeight
    doc.line(margin, currentY - 2, 190, currentY - 2)

    doc.setFont(undefined, 'normal')
    for (const v of ventes) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      const dateStr = new Date(v.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const clientStr = v.client?.nom || v.clientLibre || '—'
      const montantStr = Number(v.montantTotal).toLocaleString('fr-FR') + ' F'

      doc.text(v.numero, margin, currentY)
      doc.text(dateStr, margin + 25, currentY)
      doc.text(v.magasin.code, margin + 55, currentY)
      doc.text(clientStr.length > 20 ? clientStr.substring(0, 20) + '...' : clientStr, margin + 85, currentY)
      doc.text(montantStr, margin + 130, currentY, { align: 'right' })
      doc.text(v.modePaiement, margin + 160, currentY)

      currentY += lineHeight
    }

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 190, pageHeight - 10, { align: 'right' })
      doc.text(`${nomEntreprise} - ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10)
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ventes-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF ventes:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
