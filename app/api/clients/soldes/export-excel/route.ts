import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const q = searchParams.get('q')?.toLowerCase()

  try {
    const clients = await prisma.client.findMany({
      where: { actif: true },
      select: {
        id: true,
        code: true,
        nom: true,
        localisation: true,
        soldeInitial: true,
        avoirInitial: true,
      },
      orderBy: { nom: 'asc' },
    })

    const whereVente: any = {
      entiteId,
      statut: 'VALIDEE',
      clientId: { not: null },
    }
    const whereReglement: any = {
      entiteId,
      statut: 'VALIDE',
    }

    if (dateDebut && dateFin) {
      const gte = new Date(dateDebut + 'T00:00:00')
      const lte = new Date(dateFin + 'T23:59:59')
      whereVente.date = { gte, lte }
      whereReglement.date = { gte, lte }
    }

    const [ventes, reglements, ventesGlobales, reglementsGlobaux] = await Promise.all([
      prisma.vente.groupBy({
        by: ['clientId'],
        where: whereVente,
        _sum: { montantTotal: true },
      }),
      prisma.reglementVente.groupBy({
        by: ['clientId'],
        where: whereReglement,
        _sum: { montant: true },
      }),
      prisma.vente.groupBy({
        by: ['clientId'],
        where: { entiteId, statut: 'VALIDEE', clientId: { not: null } },
        _sum: { montantTotal: true },
      }),
      prisma.reglementVente.groupBy({
        by: ['clientId'],
        where: { entiteId, statut: 'VALIDE' },
        _sum: { montant: true },
      }),
    ])

    const venteMap = Object.fromEntries(ventes.map((v: any) => [v.clientId, v._sum.montantTotal || 0]))
    const reglementMap = Object.fromEntries(reglements.map((r: any) => [r.clientId, r._sum.montant || 0]))
    const venteGlobaleMap = Object.fromEntries(ventesGlobales.map((v: any) => [v.clientId, v._sum.montantTotal || 0]))
    const reglementGlobaleMap = Object.fromEntries(reglementsGlobaux.map((r: any) => [r.clientId, r._sum.montant || 0]))

    const rows: any[] = []
    let totalFac = 0
    let totalPai = 0
    let totalVar = 0
    let totalSolde = 0

    for (const c of clients) {
      if (q && !c.nom.toLowerCase().includes(q) && !(c.code || '').toLowerCase().includes(q) && !(c.localisation || '').toLowerCase().includes(q)) {
        continue
      }

      const factures = venteMap[c.id] || 0
      const paiements = reglementMap[c.id] || 0
      const variationPeriode = factures - paiements
      
      const facturesGlobal = venteGlobaleMap[c.id] || 0
      const paiementsGlobal = reglementGlobaleMap[c.id] || 0
      const soldeClient = facturesGlobal - paiementsGlobal + (c.soldeInitial || 0) - (c.avoirInitial || 0)

      const statut = soldeClient > 0.01 ? 'DOIT' : soldeClient < -0.01 ? 'CRÉDIT' : 'SOLDÉ'

      // Récupérer le numéro de la dernière facture pour l'affichage
      const derV = await prisma.vente.findFirst({
        where: { clientId: c.id, statut: 'VALIDEE' },
        orderBy: { date: 'desc' },
        select: { numero: true }
      })

      totalFac += factures
      totalPai += paiements
      totalVar += variationPeriode
      totalSolde += soldeClient

      rows.push({
        'N° Facture': derV?.numero || '—',
        'Code / Nom': `${c.code || ''} ${c.nom}`.trim(),
        Localisation: c.localisation || '—',
        'Total Factures (Période)': factures,
        'Paiements (Période)': paiements,
        'Reste à payer (PÉRIODE)': variationPeriode,
        'Solde Global Client': soldeClient,
        'Statut Global': statut
      })
    }

    if (rows.length > 0) {
      rows.push({
        'N° Facture': 'TOTAL',
        'Code / Nom': '',
        Localisation: '',
        'Total Factures (Période)': totalFac,
        'Paiements (Période)': totalPai,
        'Reste à payer (PÉRIODE)': totalVar,
        'Solde Global Client': totalSolde,
        'Statut Global': ''
      })
    }

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N° Facture': '', 'Code / Nom': '', Localisation: '', 'Total Factures (Période)': '', 'Paiements (Période)': '', 'Reste à payer (PÉRIODE)': '', 'Solde Global Client': '', 'Statut Global': '' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Soldes Clients')

    const colWidths = [
      { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `soldes_clients_${dateDebut || 'init'}_${dateFin || 'fin'}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Export Excel Soldes Clients:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
