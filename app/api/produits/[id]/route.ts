import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { produitSchema } from '@/lib/validations'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'produits:edit')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID produit invalide.' }, { status: 400 })
  }

  try {
    const existing = await prisma.produit.findFirst({
      where: { id, ...(session.role !== 'SUPER_ADMIN' && session.entiteId ? { entiteId: session.entiteId } : {}) },
      select: {
        id: true, code: true, designation: true, categorie: true,
        prixAchat: true, prixVente: true, prixMinimum: true, seuilMin: true,
        fournisseurId: true, actif: true, pamp: true
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Produit introuvable ou accès refusé.' }, { status: 404 })
    }
    if (!existing.actif) {
      return NextResponse.json({ error: 'Ce produit est archivé. Veuillez le restaurer d\'abord.' }, { status: 400 })
    }

    const body = await _request.json().catch(() => ({}))
    const data: any = {}
    const oldData: Record<string, any> = {}

    if (body?.designation !== undefined) {
      const val = String(body.designation).trim()
      if (val !== existing.designation) {
        oldData.designation = existing.designation
        data.designation = val
      }
    }
    if (body?.fournisseurId !== undefined) {
      const val = body.fournisseurId ? Number(body.fournisseurId) : null
      if (val !== existing.fournisseurId) {
        oldData.fournisseurId = existing.fournisseurId
        data.fournisseurId = val
      }
    }
    if (body?.prixAchat !== undefined) {
      const v = body.prixAchat
      const val = v === null || v === '' ? null : Math.max(0, Number(v))
      if (val !== existing.prixAchat) {
        oldData.prixAchat = existing.prixAchat
        data.prixAchat = val
        // Ne plus écraser le PAMP sur modification manuelle du prix d'achat
        // Le PAMP est calculé via les mouvements de stock (entrées avec prix)
      }
    }
    if (body?.prixVente !== undefined) {
      const v = body.prixVente
      const val = v === null || v === '' ? null : Math.max(0, Number(v))
      if (val !== existing.prixVente) {
        oldData.prixVente = existing.prixVente
        data.prixVente = val
      }
    }
    if (body?.prixMinimum !== undefined) {
      const v = body.prixMinimum
      const val = v === null || v === '' ? 0 : Math.max(0, Number(v))
      if (val !== existing.prixMinimum) {
        oldData.prixMinimum = existing.prixMinimum
        data.prixMinimum = val
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    // Validation croisée : prix vente >= prix minimum
    const finalPrixVente = data.prixVente !== undefined ? data.prixVente : existing.prixVente
    const finalPrixMinimum = data.prixMinimum !== undefined ? data.prixMinimum : existing.prixMinimum
    if (finalPrixVente != null && finalPrixMinimum != null && finalPrixVente < finalPrixMinimum) {
      return NextResponse.json({ error: `Le prix de vente (${finalPrixVente.toLocaleString('fr-FR')} F) ne peut pas être inférieur au prix minimum (${finalPrixMinimum.toLocaleString('fr-FR')} F).` }, { status: 400 })
    }

    const p = await prisma.produit.update({
      where: { id },
      data,
      select: {
        id: true, code: true, designation: true, categorie: true,
        prixAchat: true, prixVente: true, prixMinimum: true, seuilMin: true,
        fournisseurId: true, actif: true, pamp: true, entiteId: true
      },
    })

    const ipAddress = getIpAddress(_request)
    await logModification(
      session!,
      'PRODUIT',
      p.entiteId,
      `Modification du produit ${p.code} - ${p.designation}`,
      oldData,
      data,
      ipAddress
    )

            return NextResponse.json(p)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
    await apiCatch(e, 'api/produits/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'produits:delete')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID produit invalide.' }, { status: 400 })
  }

  try {
    const existing = await prisma.produit.findFirst({
      where: { id, ...(session!.role !== 'SUPER_ADMIN' && session!.entiteId ? { entiteId: session!.entiteId } : {}) },
      include: { stocks: { select: { quantite: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Produit introuvable ou accès refusé.' }, { status: 404 })
    }

    // Vérifier que le stock total est à zéro avant suppression définitive
    const stockTotal = existing.stocks.reduce((sum, s) => sum + s.quantite, 0)
    if (stockTotal > 0) {
      return NextResponse.json({
        error: `Impossible de supprimer : ce produit a encore ${stockTotal} unité(s) en stock. Épuisez le stock d'abord.`,
      }, { status: 400 })
    }

    // Vérifier que le produit n'est référencé dans aucune vente, achat ou mouvement
    const [venteCount, achatCount, mouvementCount] = await Promise.all([
      prisma.venteLigne.count({ where: { produitId: id }, take: 1 }),
      prisma.achatLigne.count({ where: { produitId: id }, take: 1 }),
      prisma.mouvement.count({ where: { produitId: id }, take: 1 }),
    ])
    if (venteCount > 0 || achatCount > 0 || mouvementCount > 0) {
      return NextResponse.json({
        error: 'Impossible de supprimer ce produit : il est référencé dans des ventes, achats ou mouvements. Archivez-le plutôt.',
      }, { status: 400 })
    }

    // Suppression réelle (Prisma cascade supprime la ligne de stock orpheline)
    const p = await prisma.produit.delete({
      where: { id },
    })

    const ipAddress = getIpAddress(_request)
    await logSuppression(
      session!,
      'PRODUIT',
      p.entiteId,
      `Suppression définitive du produit ${p.code} - ${p.designation}`,
      {
        id: p.id,
        code: p.code,
        designation: p.designation,
        categorie: p.categorie,
        prixAchat: p.prixAchat,
        prixVente: p.prixVente,
        prixMinimum: p.prixMinimum,
        pamp: p.pamp,
        seuilMin: p.seuilMin,
        actif: p.actif,
        entiteId: p.entiteId,
        createdAt: p.createdAt?.toISOString(),
      },
      ipAddress
    )

    return NextResponse.json({ success: true, softDeleted: false })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
    await apiCatch(e, 'api/produits/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'produits:create')
  if (authError) return authError

  const id = Number((await params).id)
  const body = await request.json().catch(() => ({}))

  if (body?.action === 'restore') {
    try {
      const existing = await prisma.produit.findFirst({
        where: { id, ...(session!.role !== 'SUPER_ADMIN' && session!.entiteId ? { entiteId: session!.entiteId } : {}) },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Produit introuvable ou accès refusé.' }, { status: 404 })
      }

      const p = await prisma.produit.update({
        where: { id },
        data: { actif: true },
      })

      const ipAddress = getIpAddress(request)
      await logModification(
        session!,
        'PRODUIT',
        existing.entiteId,
        `Restauration du produit ${p.code} - ${p.designation}`,
        { actif: false },
        { actif: true },
        ipAddress
      )

                  return NextResponse.json({ success: true, restored: true })
    } catch (e: unknown) {
      const err = e as { code?: string }
      if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
      await apiCatch(e, 'api/produits/[id]')
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
    }
  }

  if (body?.action === 'archive') {
    try {
      const existing = await prisma.produit.findFirst({
        where: { id, ...(session!.role !== 'SUPER_ADMIN' && session!.entiteId ? { entiteId: session!.entiteId } : {}) },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Produit introuvable ou accès refusé.' }, { status: 404 })
      }

      const p = await prisma.produit.update({
        where: { id },
        data: { actif: false },
      })

      const ipAddress = getIpAddress(request)
      await logSuppression(
        session!,
        'PRODUIT',
        p.entiteId,
        `Archivage du produit ${p.code} - ${p.designation}`,
        {
          id: p.id,
          code: p.code,
          designation: p.designation,
          categorie: p.categorie,
          prixAchat: p.prixAchat,
          prixVente: p.prixVente,
          prixMinimum: p.prixMinimum,
          pamp: p.pamp,
          seuilMin: p.seuilMin,
          actif: p.actif,
          entiteId: p.entiteId,
          createdAt: p.createdAt?.toISOString(),
        },
        ipAddress
      )

      return NextResponse.json({ success: true, softDeleted: true })
    } catch (e: unknown) {
      const err = e as { code?: string }
      if (err?.code === 'P2025') return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
      await apiCatch(e, 'api/produits/[id]')
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 })
}