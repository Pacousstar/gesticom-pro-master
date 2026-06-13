import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

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
    const quantite = body?.quantite
    const quantiteInitiale = body?.quantiteInitiale

    const data: Record<string, number> = {}
    if (typeof quantite === 'number' && quantite >= 0) data.quantite = Math.floor(quantite)
    if (typeof quantiteInitiale === 'number' && quantiteInitiale >= 0) data.quantiteInitiale = Math.floor(quantiteInitiale)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'quantite ou quantiteInitiale requis.' }, { status: 400 })
    }

    // Créer un mouvement de stock si la quantité change
    if (typeof quantite === 'number' && quantite >= 0 && quantite !== oldStock.quantite) {
      const diff = quantite - oldStock.quantite
      await prisma.mouvement.create({
        data: {
          date: new Date(),
          produitId: oldStock.produitId,
          magasinId: oldStock.magasinId,
          type: diff > 0 ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(diff),
          utilisateurId: session.userId,
          entiteId: session.entiteId,
          observation: `Ajustement manuel (${oldStock.quantite} → ${quantite})`,
        }
      })
    }

    const s = await prisma.stock.update({ where: { id }, data })

    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/stock')

    return NextResponse.json(s)
  } catch (e) {
    console.error('PATCH /api/stock/[id]:', e)
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
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/stock')
    
    return NextResponse.json({ success: true, id: s.id })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Ligne de stock introuvable.' }, { status: 404 })
    console.error('DELETE /api/stock/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
