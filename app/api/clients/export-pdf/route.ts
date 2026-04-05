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
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    const list = await prisma.client.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, telephone: true, type: true, plafondCredit: true, ncc: true },
    })
    
    const filtered = q
      ? list.filter(
          (c) =>
            c.nom.toLowerCase().includes(q) ||
            (c.telephone || '').toLowerCase().includes(q)
        )
      : list

    const creditIds = filtered.filter((c) => c.type === 'CREDIT').map((c) => c.id)
    let detteByClient: Record<number, number> = {}
    if (creditIds.length > 0) {
      const sums = await prisma.vente.groupBy({
        by: ['clientId'],
        where: {
          clientId: { in: creditIds },
          statut: 'VALIDEE',
          modePaiement: 'CREDIT',
        },
        _sum: { montantTotal: true },
      })
      for (const r of sums) {
        if (r.clientId != null) detteByClient[r.clientId] = r._sum.montantTotal ?? 0
      }
    }

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Liste des Clients', 15, 20)

    if (filtered.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucun client trouvé.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    let y = 35
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Nom', 15, y)
    doc.text('Téléphone', 70, y)
    doc.text('Type', 110, y)
    doc.text('Dette', 140, y)

    y += 5
    doc.line(15, y, 195, y)

    doc.setFont(undefined, 'normal')
    for (const c of filtered) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Nom', 15, y)
        doc.text('Téléphone', 70, y)
        doc.text('Type', 110, y)
        doc.text('Dette', 140, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      const nom = c.nom.length > 25 ? c.nom.substring(0, 22) + '...' : c.nom
      doc.text(nom, 15, y)
      doc.text(c.telephone || '—', 70, y)
      doc.text(c.type === 'CASH' ? 'Cash' : 'Crédit', 110, y)
      doc.text(`${formatMontant(detteByClient[c.id] || 0)} F`, 140, y)

      y += 7
    }

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/clients/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
