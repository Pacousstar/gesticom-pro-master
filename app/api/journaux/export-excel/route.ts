import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

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

    const rows = journaux.map((j) => ({
      Code: j.code,
      Libellé: j.libelle,
      Type: j.type,
      Statut: j.actif ? 'Actif' : 'Inactif',
    }))

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Code: '', Libellé: '', Type: '', Statut: '' }])
    const colWidths = [
      { wch: 12 }, // Code
      { wch: 40 }, // Libellé
      { wch: 15 }, // Type
      { wch: 10 }, // Statut
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Journaux')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `journaux_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel journaux:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
