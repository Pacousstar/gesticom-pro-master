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
    
    const list = await prisma.fournisseur.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, telephone: true, email: true, ncc: true },
    })
    
    const filtered = q
      ? list.filter(
          (f) =>
            f.nom.toLowerCase().includes(q) ||
            (f.telephone || '').toLowerCase().includes(q) ||
            (f.email || '').toLowerCase().includes(q)
        )
      : list

    const data = filtered.map((f) => ({
      Nom: f.nom,
      Téléphone: f.telephone || '',
      Email: f.email || '',
      NCC: f.ncc || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fournisseurs')

    const colWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `fournisseurs-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/fournisseurs/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
