import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Récupérer tous les produits actifs avec leurs stocks
    const produits = await prisma.produit.findMany({
      where: { actif: true },
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: {
          include: {
            magasin: {
              select: {
                code: true,
                nom: true,
              },
            },
          },
        },
      },
    })

    // Préparer les données pour Excel
    const rows: Array<Record<string, string | number | null>> = []

    for (const p of produits) {
      if (p.stocks.length > 0) {
        // Un produit peut avoir plusieurs stocks (un par magasin)
        for (const stock of p.stocks) {
          rows.push({
            Code: p.code,
            Désignation: p.designation,
            Catégorie: p.categorie,
            'Prix Achat': p.prixAchat,
            'Prix Vente': p.prixVente,
            'Seuil Min': p.seuilMin,
            Magasin: `${stock.magasin.code} - ${stock.magasin.nom}`,
            Quantité: stock.quantite,
            'Quantité Initiale': stock.quantiteInitiale,
            'Date Création': p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
          })
        }
      } else {
        // Produit sans stock
        rows.push({
          Code: p.code,
          Désignation: p.designation,
          Catégorie: p.categorie,
          'Prix Achat': p.prixAchat,
          'Prix Vente': p.prixVente,
          'Seuil Min': p.seuilMin,
          Magasin: '',
          Quantité: 0,
          'Quantité Initiale': 0,
          'Date Création': p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
        })
      }
    }

    // Créer le fichier Excel
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [
      {
        Code: '',
        Désignation: '',
        Catégorie: '',
        'Prix Achat': '',
        'Prix Vente': '',
        'Seuil Min': '',
        Magasin: '',
        Quantité: '',
        'Quantité Initiale': '',
        'Date Création': '',
      }
    ])
    
    // Ajuster la largeur des colonnes
    const colWidths = [
      { wch: 15 }, // Code
      { wch: 40 }, // Désignation
      { wch: 20 }, // Catégorie
      { wch: 12 }, // Prix Achat
      { wch: 12 }, // Prix Vente
      { wch: 10 }, // Seuil Min
      { wch: 25 }, // Magasin
      { wch: 10 }, // Quantité
      { wch: 15 }, // Quantité Initiale
      { wch: 12 }, // Date Création
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
