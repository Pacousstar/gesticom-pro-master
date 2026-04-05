import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const quantite = body?.quantite
    const quantiteInitiale = body?.quantiteInitiale

    const data: Record<string, number> = {}
    if (typeof quantite === 'number' && quantite >= 0) data.quantite = Math.floor(quantite)
    if (typeof quantiteInitiale === 'number' && quantiteInitiale >= 0) data.quantiteInitiale = Math.floor(quantiteInitiale)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'quantite ou quantiteInitiale requis.' }, { status: 400 })
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
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
