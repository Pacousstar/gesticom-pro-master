import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { fournisseurSchema } from '@/lib/validations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'fournisseurs:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const f = await prisma.fournisseur.findFirst({
    where: { id, entiteId: session!.entiteId },
  })
  if (!f) return NextResponse.json({ error: 'Fournisseur introuvable ou accès refusé.' }, { status: 404 })
  return NextResponse.json(f)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'fournisseurs:edit')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier que le fournisseur appartient à l'entité
    const existing = await prisma.fournisseur.findFirst({
      where: { id, entiteId: session!.entiteId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur introuvable ou accès refusé.' }, { status: 404 })
    }

    const body = await request.json()
    const result = validateApiRequest(fournisseurSchema.partial(), body)
    if (!result.success) return result.response
    const v = result.data

    const data: Record<string, unknown> = {}
    if (body?.code !== undefined) data.code = String(body.code).trim() || null
    if (v.nom != null) data.nom = v.nom
    if (v.telephone !== undefined) data.telephone = v.telephone
    if (v.email !== undefined) data.email = v.email
    if (v.ncc !== undefined) data.ncc = v.ncc
    if (v.localisation !== undefined) data.localisation = v.localisation
    if (v.numeroCamion !== undefined) data.numeroCamion = v.numeroCamion
    // SEC-01: Vérification cloture si modification soldes initiaux
    if (v.soldeInitial !== undefined || v.avoirInitial !== undefined) {
      const nouvelleValeur = (v.soldeInitial ?? existing.soldeInitial) - (v.avoirInitial ?? existing.avoirInitial)
      const ancienneValeur = existing.soldeInitial - existing.avoirInitial
      if (Math.abs(nouvelleValeur - ancienneValeur) > 0.01) {
        await verifierCloture(new Date(), session!)
      }
    }

    if (v.soldeInitial !== undefined) data.soldeInitial = v.soldeInitial
    if (v.avoirInitial !== undefined) data.avoirInitial = v.avoirInitial
    if (body?.actif !== undefined) data.actif = Boolean(body.actif)

    const f = await prisma.fournisseur.update({ where: { id }, data: data as object })
    return NextResponse.json(f)
  } catch (e) {
    await apiCatch(e, 'api/fournisseurs/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'fournisseurs:delete')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier si le fournisseur a des achats ou règlements (Restrict au niveau DB)
    const [achats, reglements] = await Promise.all([
      prisma.achat.count({ where: { fournisseurId: id } }),
      prisma.reglementAchat.count({ where: { fournisseurId: id } }),
    ])

    if (achats > 0 || reglements > 0) {
      return NextResponse.json({
        error: `Suppression impossible : ce fournisseur a ${achats} achat(s) et ${reglements} règlement(s) associé(s).`
      }, { status: 409 })
    }

    await prisma.fournisseur.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/fournisseurs/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
