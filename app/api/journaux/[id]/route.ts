import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { journalSchema } from '@/lib/validations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const journal = await prisma.journal.findUnique({ where: { id } })
    if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 404 })
    return NextResponse.json(journal)
  } catch (e) {
    await apiCatch(e, 'api/journaux/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const validation = validateApiRequest(journalSchema.partial(), body)
    if (!validation.success) return validation.response
    const d = validation.data

    const updateData: Record<string, unknown> = {}
    if (d.code != null) updateData.code = d.code
    if (d.libelle != null) updateData.libelle = d.libelle
    if (d.type != null) updateData.type = d.type
    if (body?.actif !== undefined) updateData.actif = Boolean(body.actif)

    const journal = await prisma.journal.update({ where: { id }, data: updateData })
    return NextResponse.json(journal)
  } catch (e: any) {
    await apiCatch(e, 'api/journaux/[id]')
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce code de journal existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    await prisma.journal.update({ where: { id }, data: { actif: false } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/journaux/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
