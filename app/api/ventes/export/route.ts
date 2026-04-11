import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const where: { date?: { gte: Date; lte: Date }; statut?: string; entiteId?: number } = {}
  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }
  where.statut = 'VALIDEE'
  if (session.role !== 'SUPER_ADMIN') {
    where.entiteId = await getEntiteId(session)
  }

  const ventes = await prisma.vente.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      magasin: { select: { code: true, nom: true } },
      client: { select: { code: true, nom: true } },
    },
  })

  const rows: any[] = []
  let totalMontant = 0
  let totalPaye = 0
  let totalReste = 0

  for (const v of ventes) {
    const dateStr = v.date.toISOString().slice(0, 10)
    const clientNom = v.client?.nom || v.clientLibre || '—'
    const clientCode = v.client?.code || '—'
    const reste = v.montantTotal - (v.montantPaye || 0)

    totalMontant += v.montantTotal
    totalPaye += v.montantPaye || 0
    totalReste += reste

    rows.push({
      'N°': v.numero,
      'Bon N°': v.numeroBon || '—',
      Date: dateStr,
      'Code Client': clientCode,
      Client: clientNom,
      Magasin: v.magasin?.code || '—',
      Montant: v.montantTotal,
      Paiement: v.modePaiement,
      'Statut paiement': v.statutPaiement === 'PAYE' ? 'Payé' : v.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Crédit',
      'Reste à payer': reste,
      Statut: v.statut === 'VALIDEE' ? 'Validée' : v.statut,
    })
  }

  // Ligne de totaux
  if (rows.length > 0) {
    rows.push({
      'N°': 'TOTAL',
      'Bon N°': '',
      Date: '',
      'Code Client': '',
      Client: '',
      Magasin: '',
      Montant: totalMontant,
      Paiement: '',
      'Statut paiement': '',
      'Reste à payer': totalReste,
      Statut: '',
    })
  }

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N°': '', 'Bon N°': '', Date: '', 'Code Client': '', Client: '', Magasin: '', Montant: '', Paiement: '', 'Statut paiement': '', 'Reste à payer': '', Statut: '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventes')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `ventes_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
