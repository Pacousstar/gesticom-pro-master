import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const stockPatchSchema = z.object({
  quantite: z.coerce.number().int().min(0).optional(),
  quantiteInitiale: z.coerce.number().int().min(0).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'stocks:entree')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier que le stock appartient à l'entité de l'utilisateur
    const oldStock = await prisma.stock.findFirst({
      where: { id, entiteId: session.entiteId },
      select: { id: true, quantite: true, produitId: true, magasinId: true }
    })
    if (!oldStock) {
      return NextResponse.json({ error: 'Stock introuvable ou accès refusé.' }, { status: 404 })
    }

    const body = await request.json()
    const validation = validateApiRequest(stockPatchSchema, body)
    if (!validation.success) return validation.response
    const patchData = validation.data

    const data: Record<string, number> = {}
    if (patchData.quantite != null) data.quantite = Math.floor(patchData.quantite)
    if (patchData.quantiteInitiale != null) data.quantiteInitiale = Math.floor(patchData.quantiteInitiale)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'quantite ou quantiteInitiale requis.' }, { status: 400 })
    }

    // Créer un mouvement de stock si la quantité change
    if (patchData.quantite != null && patchData.quantite !== oldStock.quantite) {
      const diff = patchData.quantite - oldStock.quantite
      await prisma.mouvement.create({
        data: {
          date: new Date(),
          produitId: oldStock.produitId,
          magasinId: oldStock.magasinId,
          type: diff > 0 ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(diff),
          utilisateurId: session.userId,
          entiteId: session.entiteId,
          observation: `Ajustement manuel (${oldStock.quantite} → ${patchData.quantite})`,
        }
      })
    }

    const s = await prisma.stock.update({ where: { id }, data })

    // Invalider le cache pour affichage immédiat
            return NextResponse.json(s)
  } catch (e) {
    await apiCatch(e, 'api/stock/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'stocks:sortie')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier que le stock appartient à l'entité de l'utilisateur
    const existing = await prisma.stock.findFirst({
      where: { id, entiteId: session.entiteId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Stock introuvable ou accès refusé.' }, { status: 404 })
    }

    const s = await prisma.stock.delete({ where: { id } })
    
    // Invalider le cache
            return NextResponse.json({ success: true, id: s.id })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Ligne de stock introuvable.' }, { status: 404 })
    await apiCatch(e, 'api/stock/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
