import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'
 
const { jsPDF } = require('jspdf')

function formatMontant(n: number): string {
  const num = Math.round(n || 0)
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type') // 'ACHAT' ou 'VENTE'
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const filter = request.nextUrl.searchParams.get('filter') // 'TOUT', 'SOLDER', 'NON_SOLDER'

  const entiteId = await getEntiteId(session)

  const dateFilter = dateDebut && dateFin ? {
    gte: new Date(dateDebut + 'T00:00:00'),
    lte: new Date(dateFin + 'T23:59:59'),
  } : undefined

  try {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('État des Paiements', 15, 18)
    doc.setFontSize(10)
    doc.text(`Type: ${type === 'ACHAT' ? 'Achats (Dettes)' : 'Ventes (Créances)'}`, 15, 26)
    if (dateDebut && dateFin) {
      doc.text(`Période: ${new Date(dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateFin).toLocaleDateString('fr-FR')}`, 15, 32)
    }

    const rows: Array<{ date: string; numero: string; tier: string; total: number; paye: number; solde: number; statut: string }> = []

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
        include: { 
          fournisseur: { select: { nom: true } },
          ReglementAchatLigne: { select: { montant: true } }
        },
        orderBy: { date: 'desc' }
      })

      for (const a of achats) {
        const paye = a.ReglementAchatLigne.reduce((sum, l) => sum + l.montant, 0)
        rows.push({
          date: a.date.toISOString().slice(0, 10),
          numero: a.numero,
          tier: a.fournisseur?.nom || a.fournisseurLibre || 'Divers',
          total: a.montantTotal,
          paye,
          solde: Math.max(0, (a.montantTotal || 0) - paye),
          statut: a.statutPaiement,
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
        include: { 
          client: { select: { nom: true } },
          ReglementVenteLigne: { select: { montant: true } }
        },
        orderBy: { date: 'desc' }
      })

      for (const v of ventes) {
        const paye = v.ReglementVenteLigne.reduce((sum, l) => sum + l.montant, 0)
        rows.push({
          date: v.date.toISOString().slice(0, 10),
          numero: v.numero,
          tier: v.client?.nom || v.clientLibre || 'Divers',
          total: v.montantTotal,
          paye,
          solde: Math.max(0, (v.montantTotal || 0) - paye),
          statut: v.statutPaiement,
        })
      }
    }

    // Tableau simple (sans autoTable)
    let y = 42
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Date', 15, y)
    doc.text('N°', 35, y)
    doc.text('Tiers', 60, y)
    doc.text('Total', 125, y)
    doc.text('Payé', 150, y)
    doc.text('Solde', 175, y)
    y += 4
    doc.line(15, y, 195, y)
    y += 5
    doc.setFont(undefined, 'normal')

    let totalTotal = 0
    let totalPaye = 0
    let totalSolde = 0

    for (const r of rows) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Date', 15, y)
        doc.text('N°', 35, y)
        doc.text('Tiers', 60, y)
        doc.text('Total', 125, y)
        doc.text('Payé', 150, y)
        doc.text('Solde', 175, y)
        y += 4
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      totalTotal += r.total
      totalPaye += r.paye
      totalSolde += r.solde

      const tierShort = r.tier.length > 32 ? r.tier.slice(0, 29) + '...' : r.tier
      doc.text(new Date(r.date).toLocaleDateString('fr-FR'), 15, y)
      doc.text(r.numero, 35, y)
      doc.text(tierShort, 60, y)
      doc.text(`${formatMontant(r.total)} F`, 125, y, { align: 'right' })
      doc.text(`${formatMontant(r.paye)} F`, 150, y, { align: 'right' })
      doc.text(`${formatMontant(r.solde)} F`, 175, y, { align: 'right' })
      y += 7
    }

    y += 2
    doc.line(15, y, 195, y)
    y += 6
    doc.setFont(undefined, 'bold')
    doc.text('TOTAL', 60, y)
    doc.text(`${formatMontant(totalTotal)} F`, 125, y, { align: 'right' })
    doc.text(`${formatMontant(totalPaye)} F`, 150, y, { align: 'right' })
    doc.text(`${formatMontant(totalSolde)} F`, 175, y, { align: 'right' })

    const buffer = Buffer.from(doc.output('arraybuffer'))
    const filename = `etat_paiements_${type || 'VENTE'}_${new Date().toISOString().split('T')[0]}.pdf`
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    await apiCatch(error, 'api/rapports/finances/etat-paiements/export-pdf')
    return NextResponse.json({ error: "Erreur lors de l'export PDF" }, { status: 500 })
  }
}

