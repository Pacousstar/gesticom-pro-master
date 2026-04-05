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
    const banqueId = request.nextUrl.searchParams.get('banqueId')?.trim()
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()

    const where: {
      banqueId?: number
      date?: { gte: Date; lte: Date }
      type?: string
    } = {}

    if (banqueId) {
      const bId = Number(banqueId)
      if (Number.isInteger(bId) && bId > 0) {
        where.banqueId = bId
      }
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (type) {
      where.type = type
    }

    const operations = await prisma.operationBancaire.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        banque: { select: { numero: true, nomBanque: true, libelle: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Opérations Bancaires', 15, 20)

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
          'Content-Disposition': `attachment; filename="operations-bancaires-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    // En-tête du tableau
    let y = 45
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Date', 15, y)
    doc.text('Type', 40, y)
    doc.text('Libellé', 70, y)
    doc.text('Montant', 130, y)
    doc.text('Solde', 160, y)

    y += 5
    doc.setLineWidth(0.5)
    doc.line(15, y, 195, y)

    // Lignes de données
    doc.setFont(undefined, 'normal')
    let totalDepots = 0
    let totalRetraits = 0

    for (const op of operations) {
      if (y > 270) {
        doc.addPage()
        y = 20
        // Réimprimer l'en-tête
        doc.setFont(undefined, 'bold')
        doc.text('Date', 15, y)
        doc.text('Type', 40, y)
        doc.text('Libellé', 70, y)
        doc.text('Montant', 130, y)
        doc.text('Solde', 160, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      const dateStr = new Date(op.date).toLocaleDateString('fr-FR')
      const typeLabel = 
        op.type === 'DEPOT' ? 'Dépôt' :
        op.type === 'RETRAIT' ? 'Retrait' :
        op.type === 'VIREMENT_ENTRANT' ? 'Virement +' :
        op.type === 'VIREMENT_SORTANT' ? 'Virement -' :
        op.type === 'FRAIS' ? 'Frais' :
        op.type === 'INTERETS' ? 'Intérêts' : op.type

      const isEntree = op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS'
      if (isEntree) {
        totalDepots += op.montant
      } else {
        totalRetraits += op.montant
      }

      doc.text(dateStr, 15, y)
      doc.text(typeLabel, 40, y)
      const libelle = op.libelle.length > 30 ? op.libelle.substring(0, 27) + '...' : op.libelle
      doc.text(libelle, 70, y)
      doc.text(`${isEntree ? '+' : '-'} ${formatMontant(op.montant)} F`, 130, y)
      doc.text(`${formatMontant(op.soldeApres)} F`, 160, y)

      y += 7
    }

    // Totaux
    y += 5
    doc.line(15, y, 195, y)
    y += 5
    doc.setFont(undefined, 'bold')
    doc.text('Total dépôts:', 15, y)
    doc.text(`${formatMontant(totalDepots)} F`, 130, y)
    y += 5
    doc.text('Total retraits:', 15, y)
    doc.text(`${formatMontant(totalRetraits)} F`, 130, y)
    y += 5
    doc.text('Solde net:', 15, y)
    doc.text(`${formatMontant(totalDepots - totalRetraits)} F`, 130, y)

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="operations-bancaires-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/banques/operations/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
