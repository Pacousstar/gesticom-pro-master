import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'archives:view')
  if (authError) return authError

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()

  const where: any = { entiteId: session.entiteId }
  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  const archives = await prisma.archiveVente.findMany({
    where,
    include: {
      client: { select: { nom: true } },
      magasin: { select: { code: true } },
    },
    orderBy: { date: 'desc' },
  })

  const rows: any[] = []
  let totalMontant = 0

  for (const a of archives) {
    const dateStr = a.date.toISOString().slice(0, 10)
    const clientNom = a.client?.nom || a.clientLibre || '—'

    totalMontant += a.montantTotal

    rows.push({
      'N° Facture': a.numeroFactureOrigine,
      Date: dateStr,
      Client: clientNom,
      Magasin: a.magasin?.code || '—',
      Montant: a.montantTotal,
    })
  }

  if (rows.length > 0) {
    rows.push({
      'N° Facture': 'TOTAL',
      Date: '',
      Client: '',
      Magasin: '',
      Montant: totalMontant,
    })
  }

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N° Facture': '', Date: '', Client: '', Magasin: '', Montant: '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Archives Ventes')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `archives-ventes_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
