import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    const where: { type?: string } = {}
    if (typeParam && ['ACHATS', 'VENTES', 'BANQUE', 'CAISSE', 'OD'].includes(typeParam)) {
      where.type = typeParam
    }

    const journaux = await prisma.journal.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        libelle: true,
        type: true,
        actif: true,
      },
    })

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7

    // En-tête
    doc.setFontSize(18)
    doc.text('Liste des Journaux Comptables', margin, y)
    y += 10

    doc.setFontSize(10)
    const dateStr = new Date().toLocaleDateString('fr-FR')
    doc.text(`Date d'export : ${dateStr}`, margin, y)
    y += 5
    doc.text(`Total : ${journaux.length} journal(aux)`, margin, y)
    y += 10

    // Tableau
    doc.setFontSize(9)
    const startY = y
    let currentY = startY

    // En-têtes du tableau
    doc.setFont(undefined, 'bold')
    doc.text('Code', margin, currentY)
    doc.text('Libellé', margin + 30, currentY)
    doc.text('Type', margin + 100, currentY)
    doc.text('Statut', margin + 130, currentY)
    currentY += lineHeight
    doc.line(margin, currentY - 2, 190, currentY - 2)

    doc.setFont(undefined, 'normal')
    for (const j of journaux) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      const libelle = j.libelle.length > 30 ? j.libelle.substring(0, 30) + '...' : j.libelle
      doc.text(j.code, margin, currentY)
      doc.text(libelle, margin + 30, currentY)
      doc.text(j.type, margin + 100, currentY)
      doc.text(j.actif ? 'Actif' : 'Inactif', margin + 130, currentY)

      currentY += lineHeight
    }

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 190, pageHeight - 10, { align: 'right' })
      doc.text(`GestiCom - ${dateStr}`, margin, pageHeight - 10)
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="journaux-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF journaux:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
