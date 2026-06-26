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
  const authError = requirePermission(session, 'ventes:view')
  if (authError) return authError

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
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { code: true, nom: true } },
        retours: { select: { montantTotal: true } },
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
    doc.setFont('helvetica', 'bold')
    const colPositions = {
      n: margin,
      bon: margin + 22,
      date: margin + 44,
      codeClient: margin + 62,
      client: margin + 85,
      magasin: margin + 125,
      montant: margin + 158, // Right align
      retourne: margin + 161, // Right align
      net: margin + 188, // Right align
      paiement: margin + 191,
      statutPaiement: margin + 215,
      reste: margin + 250, // Right align
      statut: margin + 255
    }

    doc.text('N°', colPositions.n, currentY)
    doc.text('Bon N°', colPositions.bon, currentY)
    doc.text('Date', colPositions.date, currentY)
    doc.text('Code Cl.', colPositions.codeClient, currentY)
    doc.text('Client', colPositions.client, currentY)
    doc.text('Mag.', colPositions.magasin, currentY)
    doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
    doc.text('Retourné', colPositions.retourne, currentY, { align: 'right' })
    doc.text('Net', colPositions.net, currentY, { align: 'right' })
    doc.text('Payé par', colPositions.paiement, currentY)
    doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
    doc.text('Reste', colPositions.reste, currentY, { align: 'right' })
    doc.text('Statut', colPositions.statut, currentY)

    currentY += lineHeight
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)

    doc.setFont('helvetica', 'normal')
    let totalMontant = 0
    let totalReste = 0

    for (const v of ventes) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
        // Redraw headers on new page
        doc.setFont('helvetica', 'bold')
        doc.text('N°', colPositions.n, currentY)
        doc.text('Bon N°', colPositions.bon, currentY)
        doc.text('Date', colPositions.date, currentY)
        doc.text('Code Cl.', colPositions.codeClient, currentY)
        doc.text('Client', colPositions.client, currentY)
        doc.text('Mag.', colPositions.magasin, currentY)
        doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
        doc.text('Retourné', colPositions.retourne, currentY, { align: 'right' })
        doc.text('Net', colPositions.net, currentY, { align: 'right' })
        doc.text('Payé par', colPositions.paiement, currentY)
        doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
        doc.text('Reste', colPositions.reste, currentY, { align: 'right' })
        doc.text('Statut', colPositions.statut, currentY)
        currentY += lineHeight
        doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
        doc.setFont('helvetica', 'normal')
      }

      const dateStr = new Date(v.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const clientStr = v.client?.nom || v.clientLibre || '—'
      const montantRetourne = (v.retours || []).reduce((s: number, r: any) => s + r.montantTotal, 0)
      const montantNet = v.montantTotal - montantRetourne
      const reste = montantNet - (v.montantPaye || 0)
      
      totalMontant += v.montantTotal
      totalReste += reste

      doc.text(v.numero, colPositions.n, currentY)
      doc.text(v.numeroBon || '—', colPositions.bon, currentY)
      doc.text(dateStr, colPositions.date, currentY)
      doc.text(v.client?.code || '—', colPositions.codeClient, currentY)
      doc.text(clientStr.length > 25 ? clientStr.substring(0, 25) + '.' : clientStr, colPositions.client, currentY)
      doc.text(v.magasin.code, colPositions.magasin, currentY)
      doc.text(v.montantTotal.toLocaleString('fr-FR'), colPositions.montant, currentY, { align: 'right' })
      doc.text(montantRetourne.toLocaleString('fr-FR'), colPositions.retourne, currentY, { align: 'right' })
      doc.text(montantNet.toLocaleString('fr-FR'), colPositions.net, currentY, { align: 'right' })
      doc.text(v.modePaiement, colPositions.paiement, currentY)
      doc.text(['PAYE', 'PARTIEL', 'CREDIT', 'REMBOURSE'].includes(v.statutPaiement)
  ? ({ PAYE: 'Payé', PARTIEL: 'Partiel', CREDIT: 'Crédit', REMBOURSE: 'Remboursé' } as Record<string, string>)[v.statutPaiement]
  : 'Crédit', colPositions.statutPaiement, currentY)
      doc.text(reste.toLocaleString('fr-FR'), colPositions.reste, currentY, { align: 'right' })
      doc.text(v.statut === 'VALIDEE' ? 'Validée' : v.statut, colPositions.statut, currentY)

      currentY += lineHeight
    }

    // Ligne de totaux
    doc.setFont('helvetica', 'bold')
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
    await apiCatch(error, 'api/ventes/export-pdf')
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
