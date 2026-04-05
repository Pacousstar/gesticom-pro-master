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
    
    const list = await prisma.archiveSoldeClient.findMany({
      orderBy: { dateArchive: 'desc' },
      include: {
        client: { select: { nom: true } },
        utilisateur: { select: { nom: true } }
      }
    })
    
    const filtered = q
      ? list.filter(
          (a) =>
            (a.client?.nom || '').toLowerCase().includes(q) ||
            (a.clientLibre || '').toLowerCase().includes(q)
        )
      : list

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Archives des Soldes Clients', 15, 20)

    if (filtered.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucune archive trouvée.', 15, 50)
    } else {
      let y = 35
      doc.setFontSize(9)
      doc.setFont(undefined, 'bold')
      doc.text('Date', 15, y)
      doc.text('Client / Tiers', 40, y)
      doc.text('Montant', 120, y)
      doc.text('Opérateur', 150, y)

      y += 5
      doc.line(15, y, 195, y)

      doc.setFont(undefined, 'normal')
      for (const a of filtered) {
        if (y > 270) {
          doc.addPage()
          y = 20
          doc.setFont(undefined, 'bold')
          doc.text('Date', 15, y)
          doc.text('Client / Tiers', 40, y)
          doc.text('Montant', 120, y)
          doc.text('Opérateur', 150, y)
          y += 5
          doc.line(15, y, 195, y)
          y += 5
          doc.setFont(undefined, 'normal')
        }

        y += 7
        const clientNom = (a.client?.nom || a.clientLibre || '—')
        const nomTrim = clientNom.length > 35 ? clientNom.substring(0, 32) + '...' : clientNom
        
        doc.text(new Date(a.dateArchive).toLocaleDateString('fr-FR'), 15, y)
        doc.text(nomTrim, 40, y)
        doc.text(`${formatMontant(a.montant)} F`, 120, y)
        doc.text(a.utilisateur?.nom || '—', 150, y)
      }
    }

    const buffer = Buffer.from(doc.output('arraybuffer'))
    const filename = `archives-soldes-${new Date().toISOString().split('T')[0]}.pdf`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/archives/clients/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
