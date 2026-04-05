import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const currentUser = { id: session.userId, entiteId: session.entiteId, role: session.role }

    const data = await req.json()
    const {
      magasinId,
      clientId,
      clientLibre,
      modePaiement,
      date,
      lignes,
      observation,
      numeroFactureOrigine
    } = data

    if (!magasinId || !lignes || lignes.length === 0) {
      return NextResponse.json({ error: 'Données incomplètes (magasin, lignes manquants)' }, { status: 400 })
    }

    // Calcul du total
    const montantTotal = lignes.reduce((acc: any, l: any) => acc + (l.quantite * l.prixUnitaire), 0)

    const nouvelleArchive = await prisma.archiveVente.create({
      data: {
        numeroFactureOrigine: numeroFactureOrigine || `A${Date.now()}`,
        date: date ? new Date(date) : new Date(),
        magasinId: Number(magasinId),
        entiteId: currentUser.entiteId,
        utilisateurId: currentUser.id,
        clientId: clientId ? Number(clientId) : null,
        clientLibre: clientLibre || (!clientId ? 'Client de passage' : null),
        montantTotal,
        lignes: {
          create: lignes.map((l: any) => ({
            designation: l.designation || ("Produit ID: " + l.produitId),
            quantite: Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire),
            montant: Number(l.quantite) * Number(l.prixUnitaire)
          }))
        }
      }
    })

    return NextResponse.json(nouvelleArchive, { status: 201 })
  } catch (error: any) {
    console.error('Erreur API Archives Ventes:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
