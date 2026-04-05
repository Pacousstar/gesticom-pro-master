import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!id) return NextResponse.json({ error: 'ID Produit requis' }, { status: 400 })

  try {
    // 1. Infos de base du produit
    const produit = await prisma.produit.findUnique({
      where: { id },
      select: { 
        id: true, 
        designation: true, 
        code: true, 
        stocks: { select: { quantite: true } }
      }
    })

    if (!produit) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

    // Calcul du stock général (car stockGeneral n'est pas un champ DB)
    const stockGeneral = produit.stocks.reduce((acc, s) => acc + s.quantite, 0)

    // 2. Ventes (Lignes) - On force le type any pour éviter les sifflements de tsc sur les relations
    const venteLignes = await prisma.venteLigne.findMany({
      where: { 
        produitId: id,
        vente: { statut: 'VALIDEE' }
      },
      include: {
        vente: {
          include: {
            client: true,
            magasin: true
          }
        }
      }
    }) as any[]

    // 3. Achats (Lignes)
    const achatLignes = await prisma.achatLigne.findMany({
      where: { 
        produitId: id,
        achat: { statut: 'VALIDE' } 
      },
      include: {
        achat: {
          include: {
            fournisseur: true,
            magasin: true
          }
        }
      }
    }) as any[]

    // 4. Fusionner en chronologie "Camicase"
    const allMoves: any[] = []

    venteLignes.forEach((l) => {
      if (!l.vente) return
      allMoves.push({
        date: l.vente.date,
        nature: 'VENTE',
        numero: l.vente.numero,
        tiers: l.vente.client?.nom || l.vente.clientLibre || 'Client Inconnu',
        magasin: l.vente.magasin?.nom || 'N/A',
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        statutPaiement: l.vente.statutPaiement
      })
    })

    achatLignes.forEach((l) => {
      if (!l.achat) return
      allMoves.push({
        date: l.achat.date,
        nature: 'ACHAT',
        numero: l.achat.numero,
        tiers: l.achat.fournisseur?.nom || 'Fournisseur Inconnu',
        magasin: l.achat.magasin?.nom || 'N/A',
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        statutPaiement: l.achat.statutPaiement
      })
    })

    // Tri chronologique inverse (plus récent en haut)
    allMoves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // 5. Statistiques de base
    const totalVendu = venteLignes.reduce((sum, l) => sum + (l.quantite || 0), 0)
    const totalAchete = achatLignes.reduce((sum, l) => sum + (l.quantite || 0), 0)

    return NextResponse.json({
      produit: { ...produit, stockGeneral },
      allMoves,
      stats: {
        totalVendu,
        totalAchete
      }
    })
  } catch (error) {
    console.error('Erreur API Historique Produit:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
