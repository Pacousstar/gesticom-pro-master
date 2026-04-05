import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  try {
    const entiteId = await getEntiteId(session)

    // 1. Récupérer tous les produits avec leurs stocks
    const produits = await prisma.produit.findMany({
      where: { entiteId, actif: true },
      include: {
        stocks: {
          include: { magasin: true }
        }
      }
    })

    const recommendations: any[] = []

    // 2. Analyser chaque produit
    for (const produit of produits) {
      const seuil = produit.seuilMin || 5
      
      // Magasins en rupture pour ce produit
      const enRupture = produit.stocks.filter(s => s.quantite < seuil)
      // Magasins en surplus pour ce produit
      const enSurplus = produit.stocks.filter(s => s.quantite > seuil)

      if (enRupture.length > 0 && enSurplus.length > 0) {
        // Trier les surplus : Dépôt principal en premier, puis par quantité décroissante
        // @ts-ignore - Le champ estDepotPrincipal vient d'être ajouté
        enSurplus.sort((a, b) => {
          if (a.magasin.estDepotPrincipal && !b.magasin.estDepotPrincipal) return -1
          if (!a.magasin.estDepotPrincipal && b.magasin.estDepotPrincipal) return 1
          return b.quantite - a.quantite
        })

        for (const dest of enRupture) {
          let quantiteManquante = seuil - dest.quantite
          
          for (const source of enSurplus) {
            if (quantiteManquante <= 0) break

            const disponible = source.quantite - seuil
            if (disponible > 0) {
              const aTransferer = Math.min(disponible, quantiteManquante)
              
              recommendations.push({
                produitId: produit.id,
                codeProduit: produit.code,
                designation: produit.designation,
                magasinOrigineId: source.magasin.id,
                magasinOrigineNom: source.magasin.nom,
                magasinDestId: dest.magasin.id,
                magasinDestNom: dest.magasin.nom,
                quantite: aTransferer,
                estSourcePrincipale: source.magasin.estDepotPrincipal,
                motif: `Réapprovisionnement (Stock actuel: ${dest.quantite}, Seuil: ${seuil})`
              })

              quantiteManquante -= aTransferer
              source.quantite -= aTransferer // Simuler pour les autres destinations
            }
          }
        }
      }
    }

    return NextResponse.json(recommendations)
  } catch (e) {
    console.error('GET /api/stock/transferts/auto:', e)
    return NextResponse.json({ error: 'Erreur lors du calcul des recommandations' }, { status: 500 })
  }
}
