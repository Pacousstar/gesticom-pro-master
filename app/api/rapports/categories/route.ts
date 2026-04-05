import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Récupérer les produits groupés par catégorie avec les agrégations
    const categories = await prisma.produit.groupBy({
      by: ['categorie'],
      where: { actif: true },
      _count: { id: true },
      _sum: {
        prixAchat: true,
        prixVente: true,
      }
    })

    // Pour chaque catégorie, récupérer le stock total
    // (Prisma groupBy ne permet pas encore de faire des sommes sur des tables liées complexes facilement en une passe)
    const resultats = await Promise.all(categories.map(async (cat) => {
      const stocks = await prisma.stock.aggregate({
        where: {
          produit: { categorie: cat.categorie, actif: true }
        },
        _sum: { quantite: true }
      })

      // Calculer la valeur du stock (Quantité * Prix) par produit pour être précis
      const produitsDeLaCat = await prisma.produit.findMany({
        where: { categorie: cat.categorie, actif: true },
        include: { stocks: true }
      })

      let totalValeurAchat = 0
      let totalValeurVente = 0
      let qteTotale = 0

      produitsDeLaCat.forEach(p => {
        const qte = p.stocks.reduce((sum, s) => sum + s.quantite, 0)
        qteTotale += qte
        totalValeurAchat += qte * (p.prixAchat || 0)
        totalValeurVente += qte * (p.prixVente || 0)
      })

      return {
        nom: cat.categorie || 'DIVERS',
        nbProduits: cat._count.id,
        quantiteTotale: qteTotale,
        valeurAchatStock: totalValeurAchat,
        valeurVenteStock: totalValeurVente,
      }
    }))

    // Trier par nombre de produits décroissant
    resultats.sort((a, b) => b.nbProduits - a.nbProduits)

    return NextResponse.json({ data: resultats })
  } catch (error) {
    console.error('Erreur Rapport Categories:', error)
    return NextResponse.json({ error: 'Erreur lors du calcul du rapport par catégories' }, { status: 500 })
  }
}
