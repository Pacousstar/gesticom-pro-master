import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const archives = await prisma.archiveVente.findMany({
      where: { entiteId: session.entiteId },
      include: {
        lignes: true,
        client: { select: { nom: true } },
        utilisateur: { select: { nom: true } }
      },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(archives)
  } catch (e) {
    console.error('Error fetching archives:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const data = await req.json()
    const { 
      numeroFactureOrigine, 
      date, 
      magasinId, 
      clientId, 
      clientLibre, 
      montantTotal, 
      observation, 
      lignes 
    } = data

    // Blindage numérique
    const rawMagasinId = Number(magasinId)
    const rawClientId = clientId ? Number(clientId) : null
    const rawMontantTotal = Number(montantTotal)

    if (isNaN(rawMagasinId)) {
       return NextResponse.json({ error: 'ID Magasin invalide' }, { status: 400 })
    }

    // Création de l'archive pure (aucune écriture de stock ou compte client)
    const archive = await prisma.archiveVente.create({
      data: {
        numeroFactureOrigine,
        date: new Date(date),
        magasinId: rawMagasinId,
        entiteId: session.entiteId,
        utilisateurId: session.userId,
        clientId: (rawClientId && !isNaN(rawClientId)) ? rawClientId : null,
        clientLibre,
        montantTotal: isNaN(rawMontantTotal) ? 0 : rawMontantTotal,
        observation,
        lignes: {
          create: (lignes || []).map((l: any) => {
             const q = Number(l.quantite)
             const pu = Number(l.prixUnitaire)
             const m = Number(l.montant)
             return {
                designation: String(l.designation || 'Article sans nom'),
                quantite: isNaN(q) ? 0 : q,
                prixUnitaire: isNaN(pu) ? 0 : pu,
                montant: isNaN(m) ? 0 : m
             }
          })
        }
      },
      include: { lignes: true }
    })

    return NextResponse.json(archive)
  } catch (e) {
    console.error('Error creating archive:', e)
    return NextResponse.json({ error: 'Erreur lors de la création de l\'archive' }, { status: 500 })
  }
}
