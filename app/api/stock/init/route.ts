import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { stockInventaireSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'stocks:init')
  if (authError) return authError

  const entiteId = session.entiteId
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non définie.' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({} as any))
    validateApiRequest(stockInventaireSchema, body)
    const produitId = body?.produitId != null ? Number(body.produitId) : null
    const magasinId = body?.magasinId != null ? Number(body.magasinId) : null
    const oneOnly = Number.isInteger(produitId) && produitId! > 0 && Number.isInteger(magasinId) && magasinId! > 0

    if (oneOnly) {
      // Vérifier que le magasin appartient à l'entité
      const magasin = await prisma.magasin.findFirst({
        where: { id: magasinId!, entiteId },
        select: { id: true },
      })
      if (!magasin) {
        return NextResponse.json({ error: 'Magasin introuvable ou accès refusé.' }, { status: 404 })
      }

      const exist = await prisma.stock.findUnique({
        where: { produitId_magasinId_entiteId: { produitId: produitId!, magasinId: magasinId!, entiteId } },
      })
      if (exist) return NextResponse.json({ created: 0 })
      await prisma.stock.create({
        data: { produitId: produitId!, magasinId: magasinId!, quantite: 0, quantiteInitiale: 0 },
      })
      return NextResponse.json({ created: 1 })
    }

const [produits, magazines] = await Promise.all([
      prisma.produit.findMany({ where: { actif: true, entiteId }, select: { id: true } }),
      prisma.magasin.findMany({ where: { actif: true, entiteId }, select: { id: true } }),
    ])

    // RÈGLE MÉTIER : Un produit = UN SEUL magasin
    // Pour chaque produit, créer un stock uniquement s'il n'en a pas déjà un
    // Si le produit n'a pas de stock, utiliser le premier magasin disponible
    let created = 0
    const premierMagasinId = magazines.length > 0 ? magazines[0].id : null
    
    if (!premierMagasinId) {
      return NextResponse.json({ error: 'Aucun magasin disponible.' }, { status: 400 })
    }

    for (const p of produits) {
      // Vérifier si le produit a déjà un stock dans l'entité
      const stockExistant = await prisma.stock.findFirst({
        where: { produitId: p.id, entiteId }
      })
      
      if (!stockExistant) {
        // Le produit n'a pas de stock, créer un stock dans le premier magasin
        await prisma.stock.create({
          data: { produitId: p.id, magasinId: premierMagasinId, quantite: 0, quantiteInitiale: 0, entiteId },
        })
        created++
      }
    }

    // La seconde boucle est supprimée : la première boucle (avec filtre entiteId) est suffisante
    // Note: L'ancien code créait des doublons car il ne filtrait pas par entiteId

    return NextResponse.json({ created })
  } catch (e) {
    await apiCatch(e, 'api/stock/init')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
