import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const f = await prisma.fournisseur.findUnique({ where: { id } })
  if (!f) return NextResponse.json({ error: 'Fournisseur introuvable.' }, { status: 404 })
  return NextResponse.json(f)
}

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
    const data: Record<string, unknown> = {}
    if (body?.code !== undefined) data.code = String(body.code).trim() || null
    if (body?.nom != null) data.nom = String(body.nom).trim()
    if (body?.telephone !== undefined) data.telephone = String(body.telephone).trim() || null
    if (body?.email !== undefined) data.email = String(body.email).trim() || null
    if (body?.ncc !== undefined) data.ncc = String(body.ncc).trim() || null
    if (body?.localisation !== undefined) data.localisation = String(body.localisation).trim() || null
    if (body?.numeroCamion !== undefined) data.numeroCamion = String(body.numeroCamion).trim() || null
    if (body?.soldeInitial !== undefined) data.soldeInitial = Number(body.soldeInitial)
    if (body?.avoirInitial !== undefined) data.avoirInitial = Number(body.avoirInitial)
    if (body?.actif !== undefined) data.actif = Boolean(body.actif)

    const f = await prisma.fournisseur.update({ where: { id }, data: data as object })
    return NextResponse.json(f)
  } catch (e) {
    console.error('PATCH /api/fournisseurs/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Note: On accepte désormais les ADMIN pour la suppression à souhait
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer un fournisseur.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Note: Le schéma Prisma gère le cascade pour les Achats et Règlements.
    await prisma.fournisseur.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/fournisseurs/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
