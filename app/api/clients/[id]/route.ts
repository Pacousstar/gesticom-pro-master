import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Utilisation directe du client Prisma

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

  const c = await prisma.client.findUnique({ where: { id } })
  if (!c) return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 })
  return NextResponse.json(c)
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
    const code = body?.code !== undefined ? (String(body.code).trim() || null) : undefined
    const nom = body?.nom != null ? String(body.nom).trim() : undefined
    const telephone = body?.telephone !== undefined ? (String(body.telephone).trim() || null) : undefined
    const type = body?.type != null
      ? (String(body.type).toUpperCase() === 'CREDIT' ? 'CREDIT' : 'CASH')
      : undefined
    const plafondCredit = body?.plafondCredit !== undefined
      ? (type === 'CREDIT' ? Math.max(0, Number(body.plafondCredit) || 0) : null)
      : undefined
    const ncc = body?.ncc !== undefined ? (String(body.ncc).trim() || null) : undefined
    const localisation = body?.localisation !== undefined ? (String(body.localisation).trim() || null) : undefined
    const soldeInitial = body?.soldeInitial !== undefined ? Number(body.soldeInitial) || 0 : undefined
    const avoirInitial = body?.avoirInitial !== undefined ? Number(body.avoirInitial) || 0 : undefined
    const email = body?.email !== undefined ? (String(body.email).trim() || null) : undefined
    const actif = body?.actif !== undefined ? Boolean(body.actif) : undefined

    const data: Record<string, unknown> = {}
    if (code !== undefined) data.code = code
    if (nom !== undefined) data.nom = nom
    if (telephone !== undefined) data.telephone = telephone
    if (email !== undefined) data.email = email
    if (type !== undefined) data.type = type
    if (plafondCredit !== undefined) data.plafondCredit = plafondCredit
    if (ncc !== undefined) data.ncc = ncc
    if (localisation !== undefined) data.localisation = localisation
    if (soldeInitial !== undefined) data.soldeInitial = soldeInitial
    if (avoirInitial !== undefined) data.avoirInitial = avoirInitial
    if (actif !== undefined) data.actif = actif

    const c = await prisma.client.update({ where: { id }, data: data as any })
    return NextResponse.json(c)
  } catch (e) {
    console.error('PATCH /api/clients/[id]:', e)
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
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer un client.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Note: Le schéma Prisma gère le cascade pour les Ventes et Règlements.
    await prisma.client.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/clients/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
