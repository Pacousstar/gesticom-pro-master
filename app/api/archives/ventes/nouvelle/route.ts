import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { montantLigneTTC, montantTotalVenteDocument } from '@/lib/calculs-commerciaux'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'archives:create')
    if (forbidden) return forbidden
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

    // Calcul du total avec TVA et remises
    let sommeLignesTTC = 0
    const lignesData = lignes.map((l: any) => {
      const qte = Number(l.quantite) || 0
      const pu = Number(l.prixUnitaire) || 0
      const tva = Number(l.tva) || 0
      const remise = Number(l.remise) || 0
      const montant = montantLigneTTC({ quantite: qte, prixUnitaire: pu, remiseLigne: remise, tvaPourcent: tva })
      sommeLignesTTC += montant
      return { designation: l.designation || ("Produit ID: " + l.produitId), quantite: qte, prixUnitaire: pu, montant }
    })

    const montantTotal = montantTotalVenteDocument(sommeLignesTTC, Number(data.remiseGlobale || 0), Number(data.fraisApproche || 0))

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
          create: lignesData
        }
      }
    })

    return NextResponse.json(nouvelleArchive, { status: 201 })
  } catch (error: any) {
    console.error('Erreur API Archives Ventes:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
