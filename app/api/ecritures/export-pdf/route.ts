import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

// Fonction pour formater les montants correctement pour jsPDF
function formatMontant(n: number): string {
  const num = Math.round(n)
  // Formatage manuel pour éviter les problèmes avec jsPDF
  const str = num.toString()
  // Ajouter des espaces tous les 3 chiffres en partant de la fin
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const limit = Math.min(5000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 1000))
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const journalId = request.nextUrl.searchParams.get('journalId')?.trim()
    const compteId = request.nextUrl.searchParams.get('compteId')?.trim()

    const where: {
      date?: { gte: Date; lte: Date }
      journalId?: number
      compteId?: number
    } = {}

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (journalId) {
      const jId = Number(journalId)
      if (Number.isInteger(jId) && jId > 0) where.journalId = jId
    }

    if (compteId) {
      const cId = Number(compteId)
      if (Number.isInteger(cId) && cId > 0) where.compteId = cId
    }

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      take: limit,
      orderBy: [{ date: 'desc' }, { numero: 'asc' }],
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
      },
    })

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 10
    const lineHeight = 6

    // En-tête
    doc.setFontSize(18)
    doc.text('Liste des Écritures Comptables', margin, y)
    y += 10

    doc.setFontSize(10)
    const dateRange = dateDebut && dateFin
      ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
      : 'Toutes les écritures'
    doc.text(dateRange, margin, y)
    y += 5
    doc.text(`Total : ${ecritures.length} écriture(s)`, margin, y)
    y += 10

    // Tableau
    doc.setFontSize(7)
    const startY = y
    let currentY = startY

    // En-têtes du tableau
    doc.setFont(undefined, 'bold')
    doc.text('Date', margin, currentY)
    doc.text('N°', margin + 20, currentY)
    doc.text('Journal', margin + 35, currentY)
    doc.text('Compte', margin + 60, currentY)
    doc.text('Libellé', margin + 90, currentY)
    doc.text('Débit', margin + 150, currentY, { align: 'right' })
    doc.text('Crédit', margin + 170, currentY, { align: 'right' })
    currentY += lineHeight
    doc.line(margin, currentY - 2, 200, currentY - 2)

    doc.setFont(undefined, 'normal')
    let totalDebit = 0
    let totalCredit = 0

    for (const e of ecritures) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      const dateStr = new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      const journalStr = e.journal.code
      const compteStr = e.compte.numero
      const libelleStr = e.libelle.length > 25 ? e.libelle.substring(0, 25) + '...' : e.libelle
      const debitStr = formatMontant(Number(e.debit))
      const creditStr = formatMontant(Number(e.credit))

      totalDebit += Number(e.debit)
      totalCredit += Number(e.credit)

      doc.text(dateStr, margin, currentY)
      doc.text(e.numero, margin + 20, currentY)
      doc.text(journalStr, margin + 35, currentY)
      doc.text(compteStr, margin + 60, currentY)
      doc.text(libelleStr, margin + 90, currentY)
      doc.text(debitStr, margin + 150, currentY, { align: 'right' })
      doc.text(creditStr, margin + 170, currentY, { align: 'right' })

      currentY += lineHeight
    }

    // Totaux
    currentY += 2
    doc.line(margin, currentY, 200, currentY)
    currentY += lineHeight
    doc.setFont(undefined, 'bold')
    doc.text('TOTAUX', margin + 90, currentY)
    doc.text(formatMontant(totalDebit), margin + 150, currentY, { align: 'right' })
    doc.text(formatMontant(totalCredit), margin + 170, currentY, { align: 'right' })

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 200, pageHeight - 10, { align: 'right' })
      doc.text(`GestiCom - ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10)
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ecritures-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF écritures:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
