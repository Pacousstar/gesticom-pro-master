import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { requirePermission } from '@/lib/require-role'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const op = await prisma.caisse.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })
  if (!op) return NextResponse.json({ error: 'Opération caisse introuvable.' }, { status: 404 })

  if (session.role !== 'SUPER_ADMIN') {
    const entiteId = await getEntiteId(session)
    const magasin = await prisma.magasin.findUnique({ where: { id: op.magasinId }, select: { entiteId: true } })
    if (!magasin || magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
  }

  return NextResponse.json(op)
}

/** Suppression définitive (Super Admin uniquement). Supprime aussi les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'caisse:delete')
  if (forbidden) return forbidden

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  try {
    const op = await prisma.caisse.findUnique({ where: { id } })
    if (!op) return NextResponse.json({ error: 'Opération caisse introuvable.' }, { status: 404 })

    await deleteEcrituresByReference('CAISSE', id)
    await prisma.caisse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/caisse/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
