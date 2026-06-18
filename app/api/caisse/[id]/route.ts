import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'
import { recalculerSoldeCaisse } from '@/lib/caisse'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const op = await prisma.caisse.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })
  if (!op) return NextResponse.json({ error: 'Opération caisse introuvable.' }, { status: 404 })

  if (session.role !== 'SUPER_ADMIN') {
    const entiteId = await getEntiteId(session)
    const magasin = await prisma.magasin.findUnique({ where: { id: op.magasinId }, select: { entiteId: true } })
    if (!magasin || magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
  }

  return NextResponse.json(op)
}

/** Suppression définitive (Super Admin uniquement). Supprime aussi les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'caisse:delete')
  if (forbidden) return forbidden

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  try {
    const op = await prisma.caisse.findUnique({ where: { id } })
    if (!op) return NextResponse.json({ error: 'Opération caisse introuvable.' }, { status: 404 })

    // VERROU DE CLÔTURE
    await verifierCloture(op.date, session)

    // P3-A : GARDE DE SÉCURITÉ — Vérifier si cette entrée caisse est liée à une vente ou un achat actif
    // RC8 : Regex améliorée couvrant tous les motifs auto-générés
    if (op.motif) {
      // Extraction des références vente (V-NNN) et achat (A-NNN)
      const venteRef = op.motif.match(/\bV\d+\b/i)
      const achatRef = op.motif.match(/\bA\d+\b/i)

      if (venteRef) {
        const venteActive = await prisma.vente.findFirst({
          where: { numero: venteRef[0], statut: { not: 'ANNULEE' } },
          select: { id: true, numero: true }
        })
        if (venteActive) {
          return NextResponse.json({
            error: `Suppression bloquée : cette opération caisse est liée à la vente ${venteActive.numero} (document actif). Supprimez ou annulez ce document pour retirer automatiquement ce mouvement.`
          }, { status: 409 })
        }
      }

      if (achatRef) {
        const achatActif = await prisma.achat.findFirst({
          where: { numero: achatRef[0] },
          select: { id: true, numero: true }
        })
        if (achatActif) {
          return NextResponse.json({
            error: `Suppression bloquée : cette opération caisse est liée à l'achat ${achatActif.numero} (document actif). Supprimez ou annulez ce document pour retirer automatiquement ce mouvement.`
          }, { status: 409 })
        }
      }

      // Vérification supplémentaire supprimée pour permettre la suppression manuelle des règlements
    }

    const magasinId = op.magasinId

    await prisma.$transaction(async (tx: any) => {
      await deleteEcrituresByReference('CAISSE', id, tx)
      await tx.caisse.delete({ where: { id } })
      await recalculerSoldeCaisse(magasinId, tx)
    })

    // P3-C : Invalider le cache pour affichage immédiat
                return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/caisse/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}