import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

function formatMontant(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    const rubriqueParam = request.nextUrl.searchParams.get('rubrique')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()

    const where: any = {}
    
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.entiteId = session.entiteId
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (typeParam && ['FIXE', 'VARIABLE'].includes(typeParam)) {
      where.type = typeParam
    }

    if (rubriqueParam) {
      where.rubrique = rubriqueParam
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) {
        where.magasinId = magId
      }
    }

    const charges = await prisma.charge.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
      },
    })

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Charges', 15, 20)

    if (dateDebut && dateFin) {
      doc.setFontSize(10)
      doc.text(`Période: ${new Date(dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateFin).toLocaleDateString('fr-FR')}`, 15, 30)
    }

    if (charges.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucune charge sur la période sélectionnée.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="charges-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    let y = 45
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Date', 15, y)
    doc.text('Type', 40, y)
    doc.text('Rubrique', 60, y)
    doc.text('Montant', 130, y)

    y += 5
    doc.line(15, y, 195, y)

    doc.setFont(undefined, 'normal')
    let total = 0

    for (const c of charges) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Date', 15, y)
        doc.text('Type', 40, y)
        doc.text('Rubrique', 60, y)
        doc.text('Montant', 130, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      total += c.montant
      doc.text(new Date(c.date).toLocaleDateString('fr-FR'), 15, y)
      doc.text(c.type, 40, y)
      const rubrique = c.rubrique.length > 20 ? c.rubrique.substring(0, 17) + '...' : c.rubrique
      doc.text(rubrique, 60, y)
      doc.text(`${formatMontant(c.montant)} F`, 130, y)

      y += 7
    }

    y += 5
    doc.line(15, y, 195, y)
    y += 5
    doc.setFont(undefined, 'bold')
    doc.text('Total:', 15, y)
    doc.text(`${formatMontant(total)} F`, 130, y)

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="charges-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/charges/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
