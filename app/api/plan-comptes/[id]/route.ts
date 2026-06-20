import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { planCompteSchema } from '@/lib/validations'

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

    const compte = await prisma.planCompte.findUnique({ where: { id } })
    if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })
    return NextResponse.json(compte)
  } catch (e) {
    await apiCatch(e, 'api/plan-comptes/[id]')
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
    const vres = validateApiRequest(planCompteSchema.partial(), body)
    if (!vres.success) return vres.response
    const planData = vres.data
    const data: Record<string, unknown> = {}
    
    if (planData.numero != null) data.numero = planData.numero
    if (planData.libelle != null) data.libelle = planData.libelle
    if (planData.classe != null) data.classe = planData.classe
    if (planData.type != null) data.type = planData.type
    if (body?.actif !== undefined) data.actif = Boolean(body.actif)

    const compte = await prisma.planCompte.update({ where: { id }, data: data as object })
    return NextResponse.json(compte)
  } catch (e: any) {
    await apiCatch(e, 'api/plan-comptes/[id]')
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
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
    await prisma.planCompte.update({ where: { id }, data: { actif: false } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/plan-comptes/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
