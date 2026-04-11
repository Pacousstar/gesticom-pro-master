import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')
  const produitId = searchParams.get('produitId')
  const magasinId = searchParams.get('magasinId')
  const type = searchParams.get('type')

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

  if (dateDebut && dateFin) {
    try {
      const d1 = new Date(dateDebut + 'T00:00:00')
      const d2 = new Date(dateFin + 'T23:59:59')
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        where.date = { gte: d1, lte: d2 }
      }
    } catch {}
  }

  if (produitId && produitId !== 'TOUT') {
    const n = parseInt(produitId)
    if (!Number.isNaN(n)) where.produitId = n
  }
  if (magasinId && magasinId !== 'TOUT') {
    const n = parseInt(magasinId)
    if (!Number.isNaN(n)) where.magasinId = n
  }
  if (type && type !== 'TOUT') where.type = type
  
  console.log('[API] GET /api/rapports/inventaire/mouvements - Where:', JSON.stringify(where));

  try {
    const mouvements = await prisma.mouvement.findMany({
      where,
      include: {
        produit: { select: { designation: true, code: true, unite: true } },
        magasin: { select: { nom: true } },
        utilisateur: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = mouvements.map(m => ({
      id: m.id,
      date: m.date,
      dateOperation: m.dateOperation,
      type: m.type,
      produit: m.produit?.designation || 'Produit inconnu',
      code: m.produit?.code || 'SANS CODE',
      unite: m.produit?.unite || 'u',
      magasin: m.magasin?.nom || 'Magasin inconnu',
      quantite: m.quantite,
      utilisateur: m.utilisateur?.nom || 'Système',
      observation: m.observation
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('❌ ERREUR GET /api/rapports/inventaire/mouvements:', error.message, error.stack)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
