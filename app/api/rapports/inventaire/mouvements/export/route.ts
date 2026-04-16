import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const produitId = searchParams.get('produitId')
  const magasinId = searchParams.get('magasinId')
  const type = searchParams.get('type')

  const entiteId = await getEntiteId(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    where.entiteId = entiteId
  }

  if (dateDebut && dateFin) {
    try {
      const d1 = new Date(dateDebut + 'T00:00:00')
      const d2 = new Date(dateFin + 'T23:59:59')
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        where.date = { gte: d1, lte: d2 }
      }
    } catch {}
  }

  if (produitId && produitId !== 'TOUT') {
    const n = parseInt(produitId)
    if (!Number.isNaN(n)) where.produitId = n
  }
  if (magasinId && magasinId !== 'TOUT') {
    const n = parseInt(magasinId)
    if (!Number.isNaN(n)) where.magasinId = n
  }
  if (type && type !== 'TOUT') where.type = type

  try {
    const mouvements = await prisma.mouvement.findMany({
      where,
      include: {
        produit: { select: { designation: true, code: true, unite: true } },
        magasin: { select: { nom: true } },
        utilisateur: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
      // Aucune limite pour l'export
    })

    const rows = mouvements.map((m, index) => ({
      'N°': index + 1,
      'Date Opération': m.dateOperation ? new Date(m.dateOperation).toLocaleString('fr-FR') : '—',
      'Code Produit': m.produit?.code || '—',
      'Désignation': m.produit?.designation || 'Inconnu',
      'Magasin': m.magasin?.nom || 'Inconnu',
      'Type': m.type,
      'Quantité': m.quantite,
      'Unité': m.produit?.unite || 'u',
      'Utilisateur': m.utilisateur?.nom || 'Système',
      'Observations': m.observation || '—',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'N°': '', 'Date Opération': '', 'Code Produit': '', 'Désignation': '', 'Magasin': '', 'Type': '', 'Quantité': '', 'Unité': '', 'Utilisateur': '', 'Observations': '' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mouvements Stock')

    // Ajustement des largeurs de colonnes
    const colWidths = [
      { wch: 6 }, { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 40 }
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `mouvements-stock-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel Mouvements error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
