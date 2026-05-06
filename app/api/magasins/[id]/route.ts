import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'magasins:edit')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const existing = await prisma.magasin.findFirst({
      where: { id, entiteId: session!.entiteId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Magasin introuvable ou accès refusé.' }, { status: 404 })
    }

    const body = await request.json()
    const data: { code?: string; nom?: string; localisation?: string; actif?: boolean } = {}

    if (body?.code != null) {
      const code = String(body.code).trim().toUpperCase()
      if (!code) return NextResponse.json({ error: 'Code non vide requis.' }, { status: 400 })
      const existant = await prisma.magasin.findFirst({ where: { code, NOT: { id }, entiteId: session!.entiteId } })
      if (existant) return NextResponse.json({ error: `Le code "${code}" est déjà utilisé.` }, { status: 400 })
      data.code = code
    }
    if (body?.nom != null) {
      const nom = String(body.nom).trim()
      if (!nom) return NextResponse.json({ error: 'Nom non vide requis.' }, { status: 400 })
      data.nom = nom
    }
    if (body?.localisation != null) data.localisation = String(body.localisation).trim()
    if (typeof body?.actif === 'boolean') data.actif = body.actif

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à modifier.' }, { status: 400 })
    }

    const magasin = await prisma.magasin.update({
      where: { id },
      data,
      select: { id: true, code: true, nom: true, localisation: true, actif: true },
    })

    await logModification(session!, 'MAGASIN', id, `Modification magasin: ${magasin.nom} (${magasin.code})`, existing, magasin, getIpAddress(request))

    return NextResponse.json(magasin)
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 404 })
    console.error('PATCH /api/magasins/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'magasins:delete')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const existing = await prisma.magasin.findFirst({
      where: { id, entiteId: session!.entiteId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Magasin introuvable ou accès refusé.' }, { status: 404 })
    }

    await prisma.magasin.update({
      where: { id },
      data: { actif: false },
    })

    await logSuppression(session!, 'MAGASIN', id, `Désactivation magasin: ${existing.nom} (${existing.code})`, existing, getIpAddress(request))

    return NextResponse.json({ ok: true })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 404 })
    console.error('DELETE /api/magasins/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
