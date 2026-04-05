import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

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

    const data = filtered.map((a) => ({
      'Date Archive': new Date(a.dateArchive).toLocaleDateString('fr-FR'),
      'Client / Tiers': a.client?.nom || a.clientLibre || '—',
      'Montant (FCFA)': a.montant,
      'Opérateur': a.utilisateur?.nom || '—',
      'Observation': a.observation || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archives_Soldes')

    const colWidths = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 40 }
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `archives-soldes-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/archives/clients/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
