import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const doublonsSchema = z.object({ idPrincipal: z.coerce.number().int().positive(), idDoublon: z.coerce.number().int().positive() })

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const products = await prisma.produit.findMany({
      where: { actif: true, entiteId },
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
        const exists = duplicates.find((d: any) => d.type === 'DESIGNATION' && d.products.some((p: any) => p.code.toLowerCase().trim() === code))
        if (!exists) {
          duplicates.push({ type: 'CODE', value: code, products: list })
        }
      }
    })

    return NextResponse.json(duplicates)
  } catch (e) {
    await apiCatch(e, 'api/produits/doublons')
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:edit')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const vres = validateApiRequest(doublonsSchema, body)
    if (!vres.success) return vres.response
    const { idPrincipal, idDoublon } = vres.data

    const principal = await prisma.produit.findFirst({
      where: { id: idPrincipal, entiteId }
    })
    if (!principal) {
      return NextResponse.json({ error: 'Produit principal introuvable ou non accessible.' }, { status: 404 })
    }
    const doublon = await prisma.produit.findFirst({
      where: { id: idDoublon, entiteId }
    })
    if (!doublon) {
      return NextResponse.json({ error: 'Doublon introuvable ou non accessible.' }, { status: 404 })
    }

    const res = await prisma.$transaction(async (tx) => {
      const stocksDoublon = await tx.stock.findMany({ where: { produitId: idDoublon, entiteId } })

      for (const sd of stocksDoublon) {
        if (sd.quantite > 0) {
          await tx.stock.upsert({
            where: {
              produitId_magasinId_entiteId: {
                produitId: idPrincipal,
                magasinId: sd.magasinId,
                entiteId
              }
            },
            create: {
              produitId: idPrincipal,
              magasinId: sd.magasinId,
              quantite: sd.quantite,
              quantiteInitiale: 0,
              entiteId
            },
            update: {
              quantite: { increment: sd.quantite }
            }
          })

          await tx.mouvement.create({
            data: {
              type: 'ENTREE',
              produitId: idPrincipal,
              magasinId: sd.magasinId,
              entiteId,
              utilisateurId: session.userId,
              quantite: sd.quantite,
              observation: `Fusion doublon (Produit ID ${idDoublon})`
            }
          })
        }
      }

      await tx.produit.update({
        where: { id: idDoublon },
        data: {
          actif: false,
          code: `OLD_${Date.now()}_${idDoublon}`
        }
      })

      return { success: true }
    })

    return NextResponse.json(res)
  } catch (e) {
    await apiCatch(e, 'api/produits/doublons')
    return NextResponse.json({ error: 'Erreur lors de la fusion' }, { status: 500 })
  }
}