import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'ventes:view')
  if (authError) return authError

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase()

  const where: any = { statut: 'VALIDEE' }
  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  const entiteId = await getEntiteId(session)
  if (session.role !== 'SUPER_ADMIN') {
    where.entiteId = entiteId
  }

  const ventes = await prisma.vente.findMany({
    where,
    take: 10000,
    include: {
      client: { select: { code: true, nom: true } },
      magasin: { select: { code: true } },
      lignes: { include: { produit: { select: { designation: true } } } },
      retours: { select: { montantTotal: true } },
    },
    orderBy: { date: 'desc' },
  })

  // Filtrage post-fetch si recherche
  const filteredVentes = search 
    ? ventes.filter(v => {
        const clientNom = v.client?.nom || v.clientLibre || v.client?.code || ''
        const prods = v.lignes.map(l => l.produit?.designation || '').join(' ')
        return v.numero.toLowerCase().includes(search) || 
               clientNom.toLowerCase().includes(search) ||
               prods.toLowerCase().includes(search)
      })
    : ventes

  const rows: any[] = []
  let totalMontant = 0
  let totalPaye = 0
  let totalReste = 0
  let totalRetourne = 0

  for (const v of filteredVentes) {
    const dateStr = v.date.toISOString().slice(0, 10)
    const clientNom = v.client?.nom || v.clientLibre || '—'
    const clientCode = v.client?.code || '—'
    const montantRetourne = (v.retours || []).reduce((s: number, r: any) => s + r.montantTotal, 0)
    const montantNet = v.montantTotal - montantRetourne
    const reste = Math.max(0, montantNet - (v.montantPaye || 0))

    totalMontant += v.montantTotal
    totalPaye += v.montantPaye || 0
    totalReste += reste
    totalRetourne += montantRetourne

    rows.push({
      'N°': v.numero,
      'Bon N°': v.numeroBon || '—',
      Date: dateStr,
      'Code Client': clientCode,
      Client: clientNom,
      Magasin: v.magasin?.code || '—',
      Montant: v.montantTotal,
      Retourné: montantRetourne,
      Net: montantNet,
      Paiement: v.modePaiement,
      'Statut paiement': ['PAYE', 'PARTIEL', 'CREDIT', 'REMBOURSE'].includes(v.statutPaiement)
  ? ({ PAYE: 'Payé', PARTIEL: 'Partiel', CREDIT: 'Crédit', REMBOURSE: 'Remboursé' } as Record<string, string>)[v.statutPaiement]
  : 'Crédit',
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
      Retourné: totalRetourne,
      Net: totalMontant - totalRetourne,
      Paiement: '',
      'Statut paiement': '',
      'Reste à payer': totalReste,
      Statut: '',
    })
  }

  if (rows.length === 0) {
    rows.push({ 'N°': '', 'Bon N°': '', Date: '', 'Code Client': '', Client: '', Magasin: '', Montant: '', Retourné: '', Net: '', Paiement: '', 'Statut paiement': '', 'Reste à payer': '', Statut: '' })
  }

  const buf = await rowsToBuffer(rows, 'Ventes')
  const filename = `ventes_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return makeResponse(buf, filename)
}
