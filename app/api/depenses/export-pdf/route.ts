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
    const categorie = request.nextUrl.searchParams.get('categorie')?.trim()
    const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()

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

    if (categorie) {
      where.categorie = categorie
    }

    if (magasinId) {
      const magId = Number(magasinId)
      if (Number.isInteger(magId) && magId > 0) {
        where.magasinId = magId
      }
    }

    const depenses = await prisma.depense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
      },
    })

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Dépenses', 15, 20)

    if (dateDebut && dateFin) {
      doc.setFontSize(10)
      doc.text(`Période: ${new Date(dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateFin).toLocaleDateString('fr-FR')}`, 15, 30)
    }

    if (depenses.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucune dépense sur la période sélectionnée.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="depenses-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    const margin = 15
    const colDate = margin
    const colCateg = 38
    const colLib = 75
    const colMontant = 145
    const colWidth = 180

    // Grouper par catégorie pour un tableau structuré (évite une ligne traversant toute une catégorie)
    const byCateg = depenses.reduce((acc, d) => {
      const c = d.categorie || 'DIVERS'
      if (!acc[c]) acc[c] = []
      acc[c].push(d)
      return acc
    }, {} as Record<string, typeof depenses>)
    const categories = Object.keys(byCateg).sort()

    let y = 42
    let total = 0

    for (const categorie of categories) {
      const lignes = byCateg[categorie]
      if (y > 255) {
        doc.addPage()
        y = 20
      }

      doc.setFont(undefined, 'bold')
      doc.setFontSize(10)
      doc.text(categorie, margin, y)
      y += 6

      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      doc.setFont(undefined, 'bold')
      doc.text('Date', colDate, y)
      doc.text('Libellé', colLib, y)
      doc.text('Montant', colMontant, y)
      y += 5
      doc.setFont(undefined, 'normal')
      // Ligne sous l'en-tête de la catégorie uniquement (pas sur toute la page)
      doc.line(colDate, y - 1, colDate + colWidth, y - 1)
      y += 2

      let sousTotal = 0
      for (const d of lignes) {
        if (y > 270) {
          doc.addPage()
          y = 20
          doc.setFont(undefined, 'bold')
          doc.text('Date', colDate, y)
          doc.text('Libellé', colLib, y)
          doc.text('Montant', colMontant, y)
          y += 5
          doc.setFont(undefined, 'normal')
        }
        sousTotal += d.montant
        total += d.montant
        doc.text(new Date(d.date).toLocaleDateString('fr-FR'), colDate, y)
        const libelle = d.libelle.length > 28 ? d.libelle.substring(0, 25) + '...' : d.libelle
        doc.text(libelle, colLib, y)
        doc.text(`${formatMontant(d.montant)} F`, colMontant, y)
        y += 6
      }

      doc.setFont(undefined, 'bold')
      doc.text(`Sous-total ${categorie}:`, colLib - 5, y)
      doc.text(`${formatMontant(sousTotal)} F`, colMontant, y)
      y += 8
      doc.setFont(undefined, 'normal')
    }

    doc.setFont(undefined, 'bold')
    doc.line(margin, y, margin + colWidth, y)
    y += 6
    doc.text('Total général:', margin, y)
    doc.text(`${formatMontant(total)} F`, colMontant, y)

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="depenses-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/depenses/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
