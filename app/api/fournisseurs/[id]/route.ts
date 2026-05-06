import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'

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
    const data: Record<string, unknown> = {}
    if (body?.code !== undefined) data.code = String(body.code).trim() || null
    if (body?.nom != null) data.nom = String(body.nom).trim()
    if (body?.telephone !== undefined) data.telephone = String(body.telephone).trim() || null
    if (body?.email !== undefined) data.email = String(body.email).trim() || null
    if (body?.ncc !== undefined) data.ncc = String(body.ncc).trim() || null
    if (body?.localisation !== undefined) data.localisation = String(body.localisation).trim() || null
    if (body?.numeroCamion !== undefined) data.numeroCamion = String(body.numeroCamion).trim() || null
    // SEC-01: Vérification cloture si modification soldes initiaux
    if (body?.soldeInitial !== undefined || body?.avoirInitial !== undefined) {
      const nouvelleValeur = (body?.soldeInitial ?? existing.soldeInitial) - (body?.avoirInitial ?? existing.avoirInitial)
      const ancienneValeur = existing.soldeInitial - existing.avoirInitial
      if (Math.abs(nouvelleValeur - ancienneValeur) > 0.01) {
        await verifierCloture(new Date(), session!)
      }
    }

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
  if (session!.role !== 'SUPER_ADMIN' && session!.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer un fournisseur.' }, { status: 403 })
  }

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
    console.error('DELETE /api/fournisseurs/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
