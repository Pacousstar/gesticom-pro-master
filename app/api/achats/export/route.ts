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
  const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase()

  const where: any = {}
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

  const achats = await prisma.achat.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      magasin: { select: { code: true, nom: true } },
      fournisseur: { select: { nom: true } },
      lignes: {
        include: {
          produit: { select: { designation: true } }
        }
      }
    },
  })

  // Filtrage post-fetch si recherche
  const filteredAchats = search 
    ? achats.filter(a => {
        const fournisseurNom = a.fournisseur?.nom || a.fournisseurLibre || ''
        const prods = a.lignes.map(l => l.produit?.designation || '').join(' ')
        return a.numero.toLowerCase().includes(search) || 
               fournisseurNom.toLowerCase().includes(search) ||
               prods.toLowerCase().includes(search) ||
               (a.numeroCamion || '').toLowerCase().includes(search)
      })
    : achats

  const rows: any[] = []
  let totalMontant = 0
  let totalPaye = 0
  let totalReste = 0

  for (const a of filteredAchats) {
    const dateStr = a.date.toISOString().slice(0, 10)
    const fournisseur = a.fournisseur?.nom ?? a.fournisseurLibre ?? '—'
    const reste = a.montantTotal - (a.montantPaye || 0)

    totalMontant += a.montantTotal
    totalPaye += a.montantPaye || 0
    totalReste += reste

    rows.push({
      'N°': a.numero,
      Date: dateStr,
      Magasin: a.magasin?.code || '—',
      Fournisseur: fournisseur,
      'N° Camion': a.numeroCamion || '—',
      Montant: a.montantTotal,
      Paiement: a.modePaiement,
      'Statut paiement': a.statutPaiement === 'PAYE' ? 'Payé' : a.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Crédit',
      'Reste à payer': reste,
    })
  }

  if (rows.length > 0) {
    rows.push({
      'N°': 'TOTAL',
      Date: '',
      Magasin: '',
      Fournisseur: '',
      'N° Camion': '',
      Montant: totalMontant,
      Paiement: '',
      'Statut paiement': '',
      'Reste à payer': totalReste,
    })
  }

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N°': '', Date: '', Magasin: '', Fournisseur: '', 'N° Camion': '', Montant: '', Paiement: '', 'Statut paiement': '', 'Reste à payer': '' }])
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
