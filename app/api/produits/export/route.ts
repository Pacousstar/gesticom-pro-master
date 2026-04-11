import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const produits = await prisma.produit.findMany({
      where: { actif: true },
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: {
          select: {
            quantite: true,
          },
        },
      },
    })

    const rows: any[] = []
    let totalStock = 0
    let totalValeurAchat = 0
    let totalValeurVente = 0

    for (const p of produits) {
      const stockActuel = p.stocks.reduce((sum, s) => sum + (s.quantite || 0), 0)
      const valeurAchat = (p.prixAchat || 0) * stockActuel
      const valeurVente = (p.prixVente || 0) * stockActuel

      totalStock += stockActuel
      totalValeurAchat += valeurAchat
      totalValeurVente += valeurVente

      rows.push({
        Code: p.code,
        Désignation: p.designation,
        Catégorie: p.categorie,
        'Prix achat': p.prixAchat || 0,
        'Prix vente': p.prixVente || 0,
        'Prix Min.': p.prixMinimum || 0,
        'Stock Actuel': stockActuel,
        'Valeur Achat': valeurAchat,
        'Valeur Vente': valeurVente,
        'Date Création': p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
      })
    }

    if (rows.length > 0) {
      rows.push({
        Code: 'TOTAL',
        Désignation: '',
        Catégorie: '',
        'Prix achat': '',
        'Prix vente': '',
        'Prix Min.': '',
        'Stock Actuel': totalStock,
        'Valeur Achat': totalValeurAchat,
        'Valeur Vente': totalValeurVente,
        'Date Création': '',
      })
    }

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Code: '', Désignation: '', Catégorie: '', 'Prix achat': '', 'Prix vente': '', 'Prix Min.': '', 'Stock Actuel': '', 'Valeur Achat': '', 'Valeur Vente': '', 'Date Création': '' }])
    
    const colWidths = [
      { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produits')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `produits_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('GET /api/produits/export:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lors de l\'export Excel.' },
      { status: 500 }
    )
  }
}
