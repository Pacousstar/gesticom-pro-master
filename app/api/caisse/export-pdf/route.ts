import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

function formatMontant(n: number): string {
  const num = Math.round(n)
  const str = num.toString()
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()

    const where: {
      date?: { gte: Date; lte: Date }
      magasinId?: number
      type?: string
    } = {}

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) where.magasinId = magId
    }

    if (typeParam && ['ENTREE', 'SORTIE'].includes(typeParam)) {
      where.type = typeParam
    }

    const operations = await prisma.caisse.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Opérations de Caisse', 15, 20)

    if (dateDebut && dateFin) {
      doc.setFontSize(10)
      doc.text(`Période: ${new Date(dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateFin).toLocaleDateString('fr-FR')}`, 15, 30)
    }

    if (operations.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucune opération sur la période sélectionnée.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="operations-caisse-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    let y = 45
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Date', 15, y)
    doc.text('Type', 40, y)
    doc.text('Magasin', 60, y)
    doc.text('Motif', 100, y)
    doc.text('Montant', 150, y)

    y += 5
    doc.setLineWidth(0.5)
    doc.line(15, y, 195, y)

    doc.setFont(undefined, 'normal')
    let totalEntrees = 0
    let totalSorties = 0

    for (const op of operations) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Date', 15, y)
        doc.text('Type', 40, y)
        doc.text('Magasin', 60, y)
        doc.text('Motif', 100, y)
        doc.text('Montant', 150, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      const dateStr = new Date(op.date).toLocaleDateString('fr-FR')
      if (op.type === 'ENTREE') {
        totalEntrees += op.montant
      } else {
        totalSorties += op.montant
      }

      doc.text(dateStr, 15, y)
      doc.text(op.type === 'ENTREE' ? 'Entrée' : 'Sortie', 40, y)
      doc.text(`${op.magasin.code}`, 60, y)
      const motif = op.motif.length > 25 ? op.motif.substring(0, 22) + '...' : op.motif
      doc.text(motif, 100, y)
      doc.text(`${formatMontant(op.montant)} F`, 150, y)

      y += 7
    }

    y += 5
    doc.line(15, y, 195, y)
    y += 5
    doc.setFont(undefined, 'bold')
    doc.text('Total entrées:', 15, y)
    doc.text(`${formatMontant(totalEntrees)} F`, 150, y)
    y += 5
    doc.text('Total sorties:', 15, y)
    doc.text(`${formatMontant(totalSorties)} F`, 150, y)
    y += 5
    doc.text('Solde:', 15, y)
    doc.text(`${formatMontant(totalEntrees - totalSorties)} F`, 150, y)

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="operations-caisse-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/caisse/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
