import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type') // 'ACHAT' ou 'VENTE'
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const filter = request.nextUrl.searchParams.get('filter') // 'TOUT', 'SOLDER', 'NON_SOLDER'

  if (type && !['ACHAT', 'VENTE'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  const entiteId = await getEntiteId(session)

  const dateFilter = dateDebut && dateFin ? {
    gte: new Date(dateDebut + 'T00:00:00'),
    lte: new Date(dateFin + 'T23:59:59'),
  } : undefined

  try {
    const rows: any[] = []
    if (type === 'ACHAT') {
      const forbidden = requirePermission(session, 'rapports:view')
      if (forbidden) return forbidden

      const where: any = { 
        date: dateFilter,
        statut: { in: ['VALIDE', 'VALIDEE'] }
      }
      if (session.role !== 'SUPER_ADMIN' && session.entiteId) where.entiteId = session.entiteId
      else if (entiteId) where.entiteId = entiteId
      if (filter === 'NON_SOLDER') where.statutPaiement = { in: ['PARTIEL', 'CREDIT'] }
      if (filter === 'SOLDER') where.statutPaiement = 'PAYE'

      const achats = await prisma.achat.findMany({
        where,
        take: 10000,
        include: { 
          fournisseur: { select: { nom: true } },
          ReglementAchatLigne: { select: { montant: true } }
        },
        orderBy: { date: 'desc' }
      })

      for (const a of achats) {
        const paye = a.ReglementAchatLigne.reduce((sum, l) => sum + l.montant, 0)
        rows.push({
          Type: 'ACHAT',
          Date: a.date.toISOString().slice(0, 10),
          Numéro: a.numero,
          Tiers: a.fournisseur?.nom || a.fournisseurLibre || 'Divers',
          'Montant Total': a.montantTotal,
          'Montant Payé': paye,
          Solde: Math.max(0, (a.montantTotal || 0) - paye),
          Statut: a.statutPaiement,
        })
      }
    } else {
      const forbidden = requirePermission(session, 'rapports:view')
      if (forbidden) return forbidden

      const where: any = { date: dateFilter, statut: { in: ['VALIDE', 'VALIDEE'] } }
      if (session.role !== 'SUPER_ADMIN' && session.entiteId) where.entiteId = session.entiteId
      else if (entiteId) where.entiteId = entiteId
      if (filter === 'NON_SOLDER') where.statutPaiement = { in: ['PARTIEL', 'CREDIT'] }
      if (filter === 'SOLDER') where.statutPaiement = 'PAYE'

      const ventes = await prisma.vente.findMany({
        where,
        take: 10000,
        include: { 
          client: { select: { nom: true } },
          ReglementVenteLigne: { select: { montant: true } }
        },
        orderBy: { date: 'desc' }
      })

      for (const v of ventes) {
        const paye = v.ReglementVenteLigne.reduce((sum, l) => sum + l.montant, 0)
        rows.push({
          Type: 'VENTE',
          Date: v.date.toISOString().slice(0, 10),
          Numéro: v.numero,
          Tiers: v.client?.nom || v.clientLibre || 'Divers',
          'Montant Total': v.montantTotal,
          'Montant Payé': paye,
          Solde: Math.max(0, (v.montantTotal || 0) - paye),
          Statut: v.statutPaiement,
        })
      }
    }

    if (rows.length > 0) {
      const totalTotal = rows.reduce((s, r) => s + (r['Montant Total'] || 0), 0)
      const totalPaye = rows.reduce((s, r) => s + (r['Montant Payé'] || 0), 0)
      const totalSolde = rows.reduce((s, r) => s + (r.Solde || 0), 0)
      rows.push({
        Type: 'TOTAL',
        Date: '',
        Numéro: '',
        Tiers: '',
        'Montant Total': totalTotal,
        'Montant Payé': totalPaye,
        Solde: totalSolde,
        Statut: '',
      })
    }

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{
      Type: '', Date: '', Numéro: '', Tiers: '', 'Montant Total': '', 'Montant Payé': '', Solde: '', Statut: ''
    }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Etat Paiements')
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
    ]

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `etat_paiements_${type || 'VENTE'}_${dateDebut || 'init'}_${dateFin || 'fin'}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Export Excel Etat Paiements:', error)
    return NextResponse.json({ error: "Erreur lors de l'export Excel" }, { status: 500 })
  }
}

