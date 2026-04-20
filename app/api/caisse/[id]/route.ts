import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'

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
    // Si oui, bloquer : la suppression doit passer par la vente/achat pour garder la cohérence
    if (op.motif) {
      const numeroMatch = op.motif.match(/(?:Vente|Achat|Règlement Achat|Règlement|VENTE|ACHAT)\s+([\w-]+)/i)
      if (numeroMatch) {
        const numero = numeroMatch[1]
        const venteActive = await prisma.vente.findFirst({
          where: { numero, statut: { not: 'ANNULEE' } },
          select: { id: true, numero: true }
        })
        const achatActif = !venteActive
          ? await prisma.achat.findFirst({ where: { numero }, select: { id: true, numero: true } })
          : null

        if (venteActive || achatActif) {
          const docType = venteActive ? 'vente' : 'achat'
          const docNumero = (venteActive ?? achatActif)!.numero
          return NextResponse.json({
            error: `Suppression bloquée : cette opération caisse est liée à ${docType} ${docNumero} (document actif). Supprimez ou annulez ce document pour retirer automatiquement ce mouvement.`
          }, { status: 409 })
        }
      }
    }

    await deleteEcrituresByReference('CAISSE', id)
    await prisma.caisse.delete({ where: { id } })

    // P3-C : Invalider le cache pour affichage immédiat
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard/caisse')
    revalidatePath('/api/caisse')

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/caisse/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
