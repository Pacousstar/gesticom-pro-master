import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const mouvement = await prisma.mouvement.findUnique({ where: { id } })
    if (!mouvement) {
      return NextResponse.json({ error: 'Mouvement introuvable.' }, { status: 404 })
    }

    await prisma.mouvement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/mouvements/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
