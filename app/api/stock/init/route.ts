import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    let body: { produitId?: number; magasinId?: number } = {}
    try {
      body = (await request.json().catch(() => ({}))) as { produitId?: number; magasinId?: number }
    } catch {
      // ignore
    }
    const produitId = body?.produitId != null ? Number(body.produitId) : null
    const magasinId = body?.magasinId != null ? Number(body.magasinId) : null
    const oneOnly = Number.isInteger(produitId) && produitId! > 0 && Number.isInteger(magasinId) && magasinId! > 0

    if (oneOnly) {
      const exist = await prisma.stock.findUnique({
        where: { produitId_magasinId: { produitId: produitId!, magasinId: magasinId! } },
      })
      if (exist) return NextResponse.json({ created: 0 })
      await prisma.stock.create({
        data: { produitId: produitId!, magasinId: magasinId!, quantite: 0, quantiteInitiale: 0 },
      })
      return NextResponse.json({ created: 1 })
    }

    const [produits, magasins] = await Promise.all([
      prisma.produit.findMany({ where: { actif: true }, select: { id: true } }),
      prisma.magasin.findMany({ where: { actif: true }, select: { id: true } }),
    ])

    // RÈGLE MÉTIER : Un produit = UN SEUL magasin
    // Pour chaque produit, créer un stock uniquement s'il n'en a pas déjà un
    // Si le produit n'a pas de stock, utiliser le premier magasin disponible
    let created = 0
    const premierMagasinId = magasins.length > 0 ? magasins[0].id : null
    
    if (!premierMagasinId) {
      return NextResponse.json({ error: 'Aucun magasin disponible.' }, { status: 400 })
    }

    for (const p of produits) {
      // Vérifier si le produit a déjà un stock (peu importe le magasin)
      const stockExistant = await prisma.stock.findFirst({
        where: { produitId: p.id }
      })
      
      if (!stockExistant) {
        // Le produit n'a pas de stock, créer un stock dans le premier magasin
        await prisma.stock.create({
          data: { produitId: p.id, magasinId: premierMagasinId, quantite: 0, quantiteInitiale: 0 },
        })
        created++
      }
    }

    return NextResponse.json({ created })
  } catch (e) {
    console.error('POST /api/stock/init:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
