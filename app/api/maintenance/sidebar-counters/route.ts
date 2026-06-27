import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const entiteId = await getEntiteId(session)
    // Filtre pour le Super Admin : si entité 0, on voit tout
    const where = entiteId && entiteId > 0 ? { entiteId } : {}
    const whereStock = entiteId && entiteId > 0 ? { magasin: { entiteId } } : {}

    const [
      ventes,
      ventesRapides,
      achats,
      produits,
      stocks,
      clients,
      fournisseurs,
      caisse,
      banque,
      depenses,
      charges,
      ecritures,
      mouvementsStock,
      commandes,
    ] = await Promise.all([
      prisma.vente.count({ where }),
      prisma.vente.count({ where: { ...where, estVenteRapide: true } }),
      prisma.achat.count({ where }),
      prisma.produit.count({ where }),
      prisma.stock.count({ where: whereStock }),
      prisma.client.count({ where }),
      prisma.fournisseur.count({ where }),
      prisma.caisse.count({ where }),
      prisma.banque.count({ where }),
      prisma.depense.count({ where }),
      prisma.charge.count({ where }),
      prisma.ecritureComptable.count({ where }),
      prisma.mouvement.count({ where }),
      prisma.commandeFournisseur.count({ where }),
    ])

    // Calcul de la valeur de stock (quantite * prixAchat)
    const stocksWithPrix = await prisma.stock.findMany({
      where: whereStock,
      select: { quantite: true, produit: { select: { prixAchat: true } } }
    })
    let valeurStock = 0
    stocksWithPrix.forEach(s => {
      valeurStock += (s.quantite || 0) * (s.produit?.prixAchat || 0)
    })

    // Calcul simplifié du bilan (Actif / Passif) pour le menu
    const ecrituresBilan = await prisma.ecritureComptable.findMany({
        where,
        select: { debit: true, credit: true, compte: { select: { classe: true } } }
    })

    let actif = 0
    let passif = 0
    ecrituresBilan.forEach(e => {
        const classe = e.compte?.classe
        if (['1', '2', '3', '4', '5'].includes(String(classe))) {
            actif += (e.debit || 0)
            passif += (e.credit || 0)
        }
    })

    return NextResponse.json({
      ventes,
      ventesRapides,
      achats,
      produits,
      stocks,
      'mouvements-stock': mouvementsStock,
      'valeur-stock': `${(valeurStock/1000000).toFixed(1)}M FCFA`,
      clients,
      fournisseurs,
      caisse,
      banque,
      depenses,
      charges,
      ecritures,
      commandes,
      bilan: `${(actif/1000000).toFixed(1)}M / ${(passif/1000000).toFixed(1)}M`
    })
  } catch (e) {
    await apiCatch(e, 'api/maintenance/sidebar-counters')
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
