import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = session.entiteId
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const magasinId = request.nextUrl.searchParams.get('magasinId')

  try {
    // Récupérer tous les produits actifs
    const produits = await prisma.produit.findMany({
      where: { actif: true },
      select: {
        id: true,
        code: true,
        designation: true,
        prixAchat: true,
        pamp: true, // Récupération du PAMP actualisé
        categorie: true,
      }
    })

    // Récupérer le stock actuel
    const stocksActuels = await prisma.stock.findMany({
      where: {
        ...(magasinId ? { magasinId: Number(magasinId) } : {}),
        ...(entiteId && session.role !== 'SUPER_ADMIN' ? { magasin: { entiteId } } : {}),
      },
      select: { produitId: true, quantite: true }
    })

    const stockMap = new Map<number, number>()
    stocksActuels.forEach(s => {
      stockMap.set(s.produitId, (stockMap.get(s.produitId) || 0) + s.quantite)
    })

    // Si une date de fin est fournie, on remonte le temps
    if (dateFin) {
      const fin = new Date(dateFin + 'T23:59:59')
      
      // Mouvements postérieurs à dateFin
      const mouvementsPosterieurs = await prisma.mouvement.findMany({
        where: {
          date: { gt: fin },
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
        },
        select: { produitId: true, quantite: true, type: true }
      })

      mouvementsPosterieurs.forEach(m => {
        const current = stockMap.get(m.produitId) || 0
        if (m.type === 'ENTREE') {
          stockMap.set(m.produitId, current - m.quantite) // On retire ce qui est entré après
        } else {
          stockMap.set(m.produitId, current + m.quantite) // On rajoute ce qui est sorti après
        }
      })
    }

    const rapportValeur = produits.map(p => {
      const qteADate = stockMap.get(p.id) || 0
      // Priorité au PAMP (qui inclut frais d'approche), fallback sur prixAchat
      const prixRevient = p.pamp && p.pamp > 0 ? p.pamp : (p.prixAchat || 0)
      const valeur = qteADate * prixRevient
      return {
        id: p.id,
        code: p.code,
        designation: p.designation,
        categorie: p.categorie,
        quantite: qteADate,
        prixUnitaire: prixRevient,
        valeur
      }
    }).filter(p => p.quantite !== 0 || p.valeur !== 0)

    const totalValeur = rapportValeur.reduce((acc, p) => acc + p.valeur, 0)

    return NextResponse.json({ data: rapportValeur, totalValeur })
  } catch (error) {
    console.error('Erreur Rapport Valeur Stock:', error)
    return NextResponse.json({ error: 'Erreur lors du calcul de la valeur du stock' }, { status: 500 })
  }
}
