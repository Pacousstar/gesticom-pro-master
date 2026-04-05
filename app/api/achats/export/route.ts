import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const limit = Math.min(5000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 1000))
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const where: { date?: { gte: Date; lte: Date }; entiteId?: number } = {}
  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }
  if (session.role !== 'SUPER_ADMIN') {
    where.entiteId = await getEntiteId(session)
  }

  const achats = await prisma.achat.findMany({
    where,
    take: limit,
    orderBy: { date: 'desc' },
    include: {
      magasin: { select: { code: true, nom: true } },
      fournisseur: { select: { nom: true } },
      lignes: { include: { produit: { select: { code: true, designation: true } } } },
    },
  })

  const rows: Array<Record<string, string | number>> = []
  for (const a of achats) {
    const dateStr = a.date.toISOString().slice(0, 10)
    const magasin = a.magasin ? `${a.magasin.code} - ${a.magasin.nom}` : ''
    const fournisseur = a.fournisseur?.nom ?? a.fournisseurLibre ?? ''
    for (const l of a.lignes) {
      rows.push({
        Date: dateStr,
        Numéro: a.numero,
        Magasin: magasin,
        Fournisseur: fournisseur,
        'Montant total': a.montantTotal,
        'Montant payé': a.montantPaye ?? 0,
        'Statut paiement': a.statutPaiement ?? 'PAYE',
        Mode: a.modePaiement,
        'Code produit': l.produit?.code ?? '',
        Désignation: l.designation,
        Quantité: l.quantite,
        'Prix unit.': l.prixUnitaire,
        Montant: l.montant,
      })
    }
    if (a.lignes.length === 0) {
      rows.push({
        Date: dateStr,
        Numéro: a.numero,
        Magasin: magasin,
        Fournisseur: fournisseur,
        'Montant total': a.montantTotal,
        'Montant payé': a.montantPaye ?? 0,
        'Statut paiement': a.statutPaiement ?? 'PAYE',
        Mode: a.modePaiement,
        'Code produit': '',
        Désignation: '',
        Quantité: 0,
        'Prix unit.': 0,
        Montant: 0,
      })
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Date: '', Numéro: '', Magasin: '', Fournisseur: '', 'Montant total': '', 'Montant payé': '', 'Statut paiement': '', Mode: '', 'Code produit': '', Désignation: '', Quantité: '', 'Prix unit.': '', Montant: '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Achats')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `achats_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
