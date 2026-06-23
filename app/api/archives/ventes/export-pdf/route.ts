import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
 
import jsPDF from 'jspdf'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'archives:view')
  if (authError) return authError

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const where: { date?: { gte: Date; lte: Date }; entiteId?: number } = {}
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }
    where.entiteId = await getEntiteId(session)

    const archives = await prisma.archiveVente.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { nom: true } },
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

    doc.setFontSize(18)
    doc.text(`Archives Ventes - ${nomEntreprise}`, margin, y)
    y += 10

    doc.setFontSize(10)
    const dateRange = dateDebut && dateFin 
      ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
      : 'Toutes les archives'
    doc.text(dateRange, margin, y)
    y += 5
    doc.text(`Total : ${archives.length} archive(s)`, margin, y)
    y += 10

    doc.setFontSize(8)
    let currentY = y

    const colPositions = {
      numero: margin,
      date: margin + 55,
      client: margin + 80,
      magasin: margin + 150,
      montant: margin + 180,
    }

    doc.setFont('helvetica', 'bold')
    doc.text('N° Facture', colPositions.numero, currentY)
    doc.text('Date', colPositions.date, currentY)
    doc.text('Client', colPositions.client, currentY)
    doc.text('Mag.', colPositions.magasin, currentY)
    doc.text('Montant', colPositions.montant, currentY, { align: 'right' })

    currentY += lineHeight
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)

    doc.setFont('helvetica', 'normal')
    let totalMontant = 0

    for (const a of archives) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
        doc.setFont('helvetica', 'bold')
        doc.text('N° Facture', colPositions.numero, currentY)
        doc.text('Date', colPositions.date, currentY)
        doc.text('Client', colPositions.client, currentY)
        doc.text('Mag.', colPositions.magasin, currentY)
        doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
        currentY += lineHeight
        doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
        doc.setFont('helvetica', 'normal')
      }

      const dateStr = new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const clientStr = a.client?.nom || a.clientLibre || '—'

      totalMontant += a.montantTotal

      doc.text(a.numeroFactureOrigine, colPositions.numero, currentY)
      doc.text(dateStr, colPositions.date, currentY)
      doc.text(clientStr.length > 25 ? clientStr.substring(0, 25) + '.' : clientStr, colPositions.client, currentY)
      doc.text(a.magasin.code, colPositions.magasin, currentY)
      doc.text(a.montantTotal.toLocaleString('fr-FR'), colPositions.montant, currentY, { align: 'right' })

      currentY += lineHeight
    }

    doc.setFont('helvetica', 'bold')
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
    doc.text('TOTAUX', colPositions.numero, currentY)
    doc.text(`${totalMontant.toLocaleString('fr-FR')} F`, colPositions.montant, currentY, { align: 'right' })

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
        'Content-Disposition': `attachment; filename="archives-ventes-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    await apiCatch(error, 'api/archives/ventes/export-pdf')
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
