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
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { code: true, nom: true } },
      },
    })

    const parametres = await prisma.parametre.findFirst()
    const nomEntreprise = parametres?.nomEntreprise || 'GESTICOM PRO'

    const doc = new jsPDF({ orientation: 'landscape' })
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const pageWidth = doc.internal.pageSize.width
    const margin = 10
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
    doc.setFontSize(8)
    let currentY = y

    // En-têtes du tableau (Landscape)
    doc.setFont(undefined, 'bold')
    const colPositions = {
      n: margin,
      bon: margin + 25,
      date: margin + 50,
      codeClient: margin + 70,
      client: margin + 95,
      magasin: margin + 140,
      montant: margin + 180, // Right align at this pos
      paiement: margin + 185,
      statutPaiement: margin + 215,
      reste: margin + 255, // Right align at this pos
      statut: margin + 260
    }

    doc.text('N°', colPositions.n, currentY)
    doc.text('Bon N°', colPositions.bon, currentY)
    doc.text('Date', colPositions.date, currentY)
    doc.text('Code Cl.', colPositions.codeClient, currentY)
    doc.text('Client', colPositions.client, currentY)
    doc.text('Mag.', colPositions.magasin, currentY)
    doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
    doc.text('Payé par', colPositions.paiement, currentY)
    doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
    doc.text('Reste', colPositions.reste, currentY, { align: 'right' })
    doc.text('Statut', colPositions.statut, currentY)

    currentY += lineHeight
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)

    doc.setFont(undefined, 'normal')
    let totalMontant = 0
    let totalReste = 0

    for (const v of ventes) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
        // Redraw headers on new page
        doc.setFont(undefined, 'bold')
        doc.text('N°', colPositions.n, currentY)
        doc.text('Bon N°', colPositions.bon, currentY)
        doc.text('Date', colPositions.date, currentY)
        doc.text('Code Cl.', colPositions.codeClient, currentY)
        doc.text('Client', colPositions.client, currentY)
        doc.text('Mag.', colPositions.magasin, currentY)
        doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
        doc.text('Payé par', colPositions.paiement, currentY)
        doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
        doc.text('Reste', colPositions.reste, currentY, { align: 'right' })
        doc.text('Statut', colPositions.statut, currentY)
        currentY += lineHeight
        doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
        doc.setFont(undefined, 'normal')
      }

      const dateStr = new Date(v.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const clientStr = v.client?.nom || v.clientLibre || '—'
      const reste = v.montantTotal - (v.montantPaye || 0)
      
      totalMontant += v.montantTotal
      totalReste += reste

      doc.text(v.numero, colPositions.n, currentY)
      doc.text(v.numeroBon || '—', colPositions.bon, currentY)
      doc.text(dateStr, colPositions.date, currentY)
      doc.text(v.client?.code || '—', colPositions.codeClient, currentY)
      doc.text(clientStr.length > 25 ? clientStr.substring(0, 25) + '.' : clientStr, colPositions.client, currentY)
      doc.text(v.magasin.code, colPositions.magasin, currentY)
      doc.text(v.montantTotal.toLocaleString('fr-FR'), colPositions.montant, currentY, { align: 'right' })
      doc.text(v.modePaiement, colPositions.paiement, currentY)
      doc.text(v.statutPaiement === 'PAYE' ? 'Payé' : v.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Crédit', colPositions.statutPaiement, currentY)
      doc.text(reste.toLocaleString('fr-FR'), colPositions.reste, currentY, { align: 'right' })
      doc.text(v.statut === 'VALIDEE' ? 'Validée' : v.statut, colPositions.statut, currentY)

      currentY += lineHeight
    }

    // Ligne de totaux
    doc.setFont(undefined, 'bold')
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
    doc.text('TOTAUX', colPositions.n, currentY)
    doc.text(totalMontant.toLocaleString('fr-FR') + ' F', colPositions.montant, currentY, { align: 'right' })
    doc.text(totalReste.toLocaleString('fr-FR') + ' F', colPositions.reste, currentY, { align: 'right' })

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
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
