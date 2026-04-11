import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const dateFin = searchParams.get('dateFin') || new Date().toISOString().split('T')[0]
  const magasinId = searchParams.get('magasinId')

  try {
    const entiteId = await getEntiteId(session)
    const where: any = {}

    // Filtrage par entité (support SUPER_ADMIN)
    if (session.role === 'SUPER_ADMIN') {
      const entiteIdFromParams = searchParams.get('entiteId')?.trim()
      if (entiteIdFromParams) {
        where.entiteId = Number(entiteIdFromParams)
      } else if (entiteId > 0) {
        where.entiteId = entiteId
      }
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }

    if (!where.entiteId) return NextResponse.json({ error: 'Entité non définie.' }, { status: 400 })

    // Validation du magasinId
    let parsedMagasinId: number | undefined = undefined
    if (magasinId && magasinId !== 'TOUT') {
      const n = parseInt(magasinId)
      if (!Number.isNaN(n)) parsedMagasinId = n
    }

    // 1. Récupérer les produits actifs
    const produits = await prisma.produit.findMany({
      where: { actif: true, entiteId },
      select: {
        id: true,
        designation: true,
        code: true,
        categorie: true,
        unite: true,
        pamp: true,
        prixAchat: true,
      }
    })

    // 2. Récupérer les stocks actuels
    const stocks = await prisma.stock.findMany({
      where: parsedMagasinId ? { magasinId: parsedMagasinId } : { entiteId },
      select: {
        produitId: true,
        quantite: true,
      }
    })

    // 3. Récupérer les mouvements POSTÉRIEURS à dateFin pour recalculer le stock à cette date
    // Stock à dateFin = StockActuel - Mouvements(Entrée, après dateFin) + Mouvements(Sortie, après dateFin)
    
    // Sécurisation de la date
    let dateLimit: Date;
    try {
      dateLimit = new Date(dateFin + 'T23:59:59');
      if (isNaN(dateLimit.getTime())) dateLimit = new Date();
    } catch {
      dateLimit = new Date();
    }

    const mouvementsPost = await prisma.mouvement.findMany({
      where: {
        entiteId,
        date: { gt: dateLimit },
        ...(parsedMagasinId ? { magasinId: parsedMagasinId } : {})
      },
      select: {
        produitId: true,
        type: true,
        quantite: true,
      }
    })

    const stockMap: Record<number, number> = {}
    stocks.forEach((s: any) => {
      stockMap[s.produitId] = (stockMap[s.produitId] || 0) + (s.quantite || 0)
    })

    // Ajustement inverse pour remonter dans le temps
    mouvementsPost.forEach((m: any) => {
      if (m.type === 'ENTREE' || m.type === 'TRANSFERT_IN' || (m.type === 'AJUSTEMENT' && m.quantite > 0)) {
        stockMap[m.produitId] = (stockMap[m.produitId] || 0) - m.quantite
      } else if (m.type === 'SORTIE' || m.type === 'TRANSFERT_OUT' || (m.type === 'AJUSTEMENT' && m.quantite < 0)) {
        stockMap[m.produitId] = (stockMap[m.produitId] || 0) + Math.abs(m.quantite)
      }
    })

    const data = produits.map((p: any) => {
      const qte = stockMap[p.id] || 0
      const prixValo = p.pamp || p.prixAchat || 0
      return {
        id: p.id,
        code: p.code,
        designation: p.designation,
        categorie: p.categorie,
        unite: p.unite,
        quantite: qte,
        pamp: prixValo,
        valeurTotal: qte * prixValo
      }
    }).filter(d => d.quantite !== 0)

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/rapports/inventaire/valeur:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
