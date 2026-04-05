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

    const data = filtered.map((c) => ({
      Nom: c.nom,
      Téléphone: c.telephone || '',
      Type: c.type === 'CASH' ? 'Cash' : 'Crédit',
      'Plafond crédit': c.plafondCredit || 0,
      'Dette actuelle': detteByClient[c.id] || 0,
      NCC: c.ncc || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients')

    const colWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `clients-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/clients/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
