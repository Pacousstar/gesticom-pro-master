import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logModification, getIpAddress, getUserAgent } from '@/lib/audit'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID produit invalide.' }, { status: 400 })
  }

  try {
    const body = await _request.json().catch(() => ({}))
    const data: any = {}
    if (body?.designation !== undefined) {
      data.designation = String(body.designation).trim()
    }
    if (body?.fournisseurId !== undefined) {
      data.fournisseurId = body.fournisseurId ? Number(body.fournisseurId) : null
    }
    if (body?.prixAchat !== undefined) {
      const v = body.prixAchat
      data.prixAchat = v === null || v === '' ? null : Math.max(0, Number(v))
    }
    if (body?.prixVente !== undefined) {
      const v = body.prixVente
      data.prixVente = v === null || v === '' ? null : Math.max(0, Number(v))
    }
    if (body?.prixMinimum !== undefined) {
      const v = body.prixMinimum
      data.prixMinimum = v === null || v === '' ? 0 : Math.max(0, Number(v))
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const p = await prisma.produit.update({
      where: { id },
      data,
      select: { id: true, code: true, designation: true, categorie: true, prixAchat: true, prixVente: true, prixMinimum: true, seuilMin: true },
    })

    // Logger la modification
    const ipAddress = getIpAddress(_request)
    await logModification(
      session,
      'PRODUIT',
      p.id,
      `Modification du produit ${p.code} - ${p.designation}`,
      {},
      data,
      ipAddress
    )

    revalidatePath('/dashboard/produits')
    revalidatePath('/api/produits')

    return NextResponse.json(p)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
    console.error('PATCH /api/produits/[id]:', e)
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
    return NextResponse.json({ error: 'ID produit invalide.' }, { status: 400 })
  }

  try {
    // Hard Delete : Suppression réelle de la base
    // Note: Le schéma Prisma gère le cascade (onDelete: Cascade) pour les Stocks, Ventes, Achats, etc.
    const p = await prisma.produit.delete({
      where: { id },
    })

    const ipAddress = getIpAddress(_request)
    await logModification(
      session,
      'PRODUIT',
      id,
      `Suppression définitive du produit ${p.code} - ${p.designation}`,
      { code: p.code },
      { status: 'DELETED' },
      ipAddress
    )

    revalidatePath('/dashboard/produits')
    revalidatePath('/api/produits')

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
    console.error('DELETE /api/produits/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
