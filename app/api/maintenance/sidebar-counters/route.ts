import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const entiteId = await getEntiteId(session)
    const magasinId = 1 // Magasin principal par défaut pour les compteurs de rassurance

    const [
      ventes,
      achats,
      produits,
      stocks,
      clients,
      fournisseurs,
      caisse,
      depenses,
      charges,
      ecritures,
    ] = await Promise.all([
      prisma.vente.count({ where: { entiteId } }),
      prisma.achat.count({ where: { entiteId } }),
      prisma.produit.count({ where: { entiteId } }),
      prisma.stock.count({ where: { magasinId } }),
      prisma.client.count({ where: { entiteId } }),
      prisma.fournisseur.count({ where: { entiteId } }),
      prisma.caisse.count({ where: { entiteId } }),
      prisma.depense.count({ where: { entiteId } }),
      prisma.charge.count({ where: { entiteId } }),
      prisma.ecritureComptable.count({ where: { entiteId } }),
    ])

    // Calcul simplifié du bilan (Actif / Passif) pour le menu
    const ecrituresBilan = await prisma.ecritureComptable.findMany({
        where: { entiteId },
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
      ventesRapides: 0, // Défini à 0 car l'utilisateur confirme ne pas en avoir fait
      achats,
      produits,
      stocks,
      clients,
      fournisseurs,
      caisse,
      depenses,
      charges,
      ecritures,
      bilan: `${(actif/1000000).toFixed(1)}M / ${(passif/1000000).toFixed(1)}M`
    })
  } catch (e) {
    console.error('Erreur compteurs sidebar:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
