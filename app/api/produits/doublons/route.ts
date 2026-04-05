import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET: Détecte les doublons par désignation ou par code
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const products = await prisma.produit.findMany({
      where: { actif: true },
      include: { stocks: true }
    })

    const duplicates: any[] = []
    const seenDesignations = new Map<string, any[]>()
    const seenCodes = new Map<string, any[]>()

    products.forEach((p: any) => {
      const des = p.designation.toLowerCase().trim()
      const code = p.code.toLowerCase().trim()

      if (!seenDesignations.has(des)) seenDesignations.set(des, [])
      seenDesignations.get(des)?.push(p)

      if (!seenCodes.has(code)) seenCodes.set(code, [])
      seenCodes.get(code)?.push(p)
    })

    seenDesignations.forEach((list, des) => {
      if (list.length > 1) {
        duplicates.push({ type: 'DESIGNATION', value: des, products: list })
      }
    })

    seenCodes.forEach((list, code) => {
      if (list.length > 1) {
        // Éviter les doublons déjà identifiés par désignation
        const exists = duplicates.find((d: any) => d.type === 'DESIGNATION' && d.products.some((p: any) => p.code.toLowerCase().trim() === code))
        if (!exists) {
          duplicates.push({ type: 'CODE', value: code, products: list })
        }
      }
    })

    return NextResponse.json(duplicates)
  } catch (e) {
    console.error('Error detecting duplicates:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST: Fusionne un doublon vers un produit principal
 * On archive le doublon et on transfère son stock au principal
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { idPrincipal, idDoublon } = await req.json()

    if (!idPrincipal || !idDoublon) {
      return NextResponse.json({ error: 'IDs manquants' }, { status: 400 })
    }

    const res = await prisma.$transaction(async (tx) => {
      // 1. Récupérer les stocks du doublon
      const stocksDoublon = await tx.stock.findMany({ where: { produitId: idDoublon } })

      // 2. Transférer vers le principal
      for (const sd of stocksDoublon) {
        if (sd.quantite > 0) {
          await tx.stock.upsert({
            where: { produitId_magasinId: { produitId: idPrincipal, magasinId: sd.magasinId } },
            create: { produitId: idPrincipal, magasinId: sd.magasinId, quantite: sd.quantite, quantiteInitiale: 0 },
            update: { quantite: { increment: sd.quantite } }
          })
          
          // Créer un mouvement de transfert pour la traçabilité
          await tx.mouvement.create({
            data: {
              type: 'ENTREE',
              produitId: idPrincipal,
              magasinId: sd.magasinId,
              entiteId: session.entiteId!,
              utilisateurId: session.userId,
              quantite: sd.quantite,
              observation: `Fusion doublon (Produit ID ${idDoublon})`
            }
          })
        }
      }

      // 3. Archiver le doublon pour ne pas perdre l'historique mais le sortir de la vue active
      await tx.produit.update({
        where: { id: idDoublon },
        data: { actif: false, code: `OLD_${Date.now()}_${idDoublon}` } // Changer le code pour libérer le doublon
      })

      return { success: true }
    })

    return NextResponse.json(res)
  } catch (e) {
    console.error('Error merging duplicates:', e)
    return NextResponse.json({ error: 'Erreur lors de la fusion' }, { status: 500 })
  }
}
