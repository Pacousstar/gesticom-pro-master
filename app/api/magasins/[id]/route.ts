import { NextRequest, NextResponse } from 'next/server'
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
    const data: { code?: string; nom?: string; localisation?: string; actif?: boolean } = {}

    if (body?.code != null) {
      const code = String(body.code).trim().toUpperCase()
      if (!code) return NextResponse.json({ error: 'Code non vide requis.' }, { status: 400 })
      const existant = await prisma.magasin.findFirst({ where: { code, NOT: { id } } })
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
    return NextResponse.json(magasin)
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 404 })
    console.error('PATCH /api/magasins/[id]:', e)
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
    await prisma.magasin.update({
      where: { id },
      data: { actif: false },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 404 })
    console.error('DELETE /api/magasins/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
