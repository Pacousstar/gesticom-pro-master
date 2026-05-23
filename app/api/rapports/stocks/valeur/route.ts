import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  const entiteIdFromSession = session.entiteId
  let entiteId = entiteIdFromSession
  
  // Support Super Admin override
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      entiteId = Number(entiteIdFromParams)
    }
  }

  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const magasinId = request.nextUrl.searchParams.get('magasinId')

  try {
    // Récupérer tous les produits de l'entité (y compris archivés s'ils ont du stock)
    const produits = await prisma.produit.findMany({
      where: { entiteId: entiteId || undefined },
      select: {
        id: true,
        code: true,
        designation: true,
        prixAchat: true,
        pamp: true,
        categorie: true,
      }
    })

    // Construction du filtre de base
    const mouvementWhere: any = {
      ...(magasinId ? { magasinId: Number(magasinId) } : {}),
      ...(entiteId ? { entiteId } : {}),
    }

    // Si une date de fin est fournie, on filtre les mouvements jusqu'à cette date
    if (dateFin) {
      const fin = new Date(dateFin + 'T23:59:59')
      mouvementWhere.date = { lte: fin }
    }

    // Calcul du stock basé sur les mouvements (approche conventionnelle)
    const mouvements = await prisma.mouvement.findMany({
      where: mouvementWhere,
      select: { produitId: true, quantite: true, type: true }
    })

    // Agréger les mouvements par produit
    const stockMap = new Map<number, number>()
    mouvements.forEach(m => {
      const current = stockMap.get(m.produitId) || 0
      if (m.type === 'ENTREE') {
        stockMap.set(m.produitId, current + m.quantite)
      } else {
        stockMap.set(m.produitId, current - m.quantite)
      }
    })

    // Si pas de date fin (stock actuel), récupérer les stocks initiaux pour les produits sans mouvement
    if (!dateFin) {
      const stocksActuels = await prisma.stock.findMany({
        where: {
          ...(magasinId ? { magasinId: Number(magasinId) } : {}),
          ...(entiteId ? { entiteId } : {}),
        },
        select: { produitId: true, quantite: true }
      })

      stocksActuels.forEach(s => {
        const current = stockMap.get(s.produitId) || 0
        stockMap.set(s.produitId, current + s.quantite)
      })
    }

    const rapportValeur = produits.map(p => {
      const qteADate = stockMap.get(p.id) || 0
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
