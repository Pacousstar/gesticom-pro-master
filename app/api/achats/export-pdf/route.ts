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
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        fournisseur: { select: { nom: true } },
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
    doc.text(`Liste des Achats - ${nomEntreprise}`, margin, y)
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
    let currentY = y

    // En-têtes du tableau (Landscape)
    doc.setFont(undefined, 'bold')
    const colPositions = {
      n: margin,
      date: margin + 25,
      magasin: margin + 50,
      fournisseur: margin + 70,
      camion: margin + 130,
      montant: margin + 175, // Right align
      paiement: margin + 180,
      statutPaiement: margin + 215,
      reste: margin + 275, // Right align
    }

    doc.text('N°', colPositions.n, currentY)
    doc.text('Date', colPositions.date, currentY)
    doc.text('Magasin', colPositions.magasin, currentY)
    doc.text('Fournisseur', colPositions.fournisseur, currentY)
    doc.text('N° Camion', colPositions.camion, currentY)
    doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
    doc.text('Paiement', colPositions.paiement, currentY)
    doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
    doc.text('Reste', colPositions.reste, currentY, { align: 'right' })

    currentY += lineHeight
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)

    doc.setFont(undefined, 'normal')
    let totalMontant = 0
    let totalReste = 0

    for (const a of achats) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
        doc.setFont(undefined, 'bold')
        doc.text('N°', colPositions.n, currentY)
        doc.text('Date', colPositions.date, currentY)
        doc.text('Magasin', colPositions.magasin, currentY)
        doc.text('Fournisseur', colPositions.fournisseur, currentY)
        doc.text('N° Camion', colPositions.camion, currentY)
        doc.text('Montant', colPositions.montant, currentY, { align: 'right' })
        doc.text('Paiement', colPositions.paiement, currentY)
        doc.text('Statut Paiement', colPositions.statutPaiement, currentY)
        doc.text('Reste', colPositions.reste, currentY, { align: 'right' })
        currentY += lineHeight
        doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
        doc.setFont(undefined, 'normal')
      }

      const dateStr = new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const fournisseurStr = a.fournisseur?.nom || a.fournisseurLibre || '—'
      const reste = a.montantTotal - (a.montantPaye || 0)
      
      totalMontant += a.montantTotal
      totalReste += reste

      doc.text(a.numero, colPositions.n, currentY)
      doc.text(dateStr, colPositions.date, currentY)
      doc.text(a.magasin.code, colPositions.magasin, currentY)
      doc.text(fournisseurStr.length > 30 ? fournisseurStr.substring(0, 30) + '.' : fournisseurStr, colPositions.fournisseur, currentY)
      doc.text(a.numeroCamion || '—', colPositions.camion, currentY)
      doc.text(a.montantTotal.toLocaleString('fr-FR'), colPositions.montant, currentY, { align: 'right' })
      doc.text(a.modePaiement, colPositions.paiement, currentY)
      doc.text(a.statutPaiement === 'PAYE' ? 'Payé' : a.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Crédit', colPositions.statutPaiement, currentY)
      doc.text(reste.toLocaleString('fr-FR'), colPositions.reste, currentY, { align: 'right' })

      currentY += lineHeight
    }

    // Totaux
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
        'Content-Disposition': `attachment; filename="achats-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF achats:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
