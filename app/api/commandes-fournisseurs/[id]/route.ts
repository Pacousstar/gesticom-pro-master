import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { unauthorized, notFound, badRequest, handleApiError } from '@/lib/api-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { commandeFournisseurSchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorized()
  const authError = requirePermission(session, 'commandes:view')
  if (authError) return authError
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return badRequest('ID invalide')

  const commande = await prisma.commandeFournisseur.findUnique({
    where: { id },
    include: {
      fournisseur: { select: { id: true, nom: true, telephone: true, localisation: true, ncc: true } },
      magasin: { select: { id: true, code: true, nom: true } },
      lignes: true
    }
  })

  if (!commande) return notFound('Commande introuvable')
  return NextResponse.json(commande)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorized()
  const authError = requirePermission(session, 'commandes:edit')
  if (authError) return authError
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return badRequest('ID invalide')

  try {
    const body = await request.json()
    const vres = validateApiRequest(commandeFournisseurSchema.partial(), body)
    if (!vres.success) return vres.response
    const cfData = vres.data
    const entiteId = await getEntiteId(session)

    // Modification complète (Full Update)
    if (cfData.lignes) {
      await prisma.$transaction([
        // 1. Supprimer les anciennes lignes
        prisma.commandeFournisseurLigne.deleteMany({ where: { commandeId: id } }),
        // 2. Mettre à jour les infos et recréer les lignes
        prisma.commandeFournisseur.update({
          where: { id },
          data: {
            date: cfData.date ? new Date(cfData.date) : undefined,
            fournisseurId: cfData.fournisseurId ?? null,
            fournisseurLibre: cfData.fournisseurLibre,
            magasinId: cfData.magasinId ?? undefined,
            montantTotal: cfData.montantTotal ?? 0,
            observation: cfData.observation,
            statut: body.statut,
            lignes: {
              create: cfData.lignes.map((l: any) => ({
                produitId: l.produitId,
                designation: l.designation,
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
                montant: l.montant
              }))
            }
          }
        })
      ])
    } else {
      // Mise à jour de champ simple (ex: statut)
      await prisma.commandeFournisseur.update({
        where: { id },
        data: {
          statut: body.statut,
          observation: cfData.observation
        }
      })
    }

        return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorized()

  const forbiddenResp = requirePermission(session, 'commandes:delete')
  if (forbiddenResp) return forbiddenResp

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return badRequest('ID invalide')

  try {
    // Vérifier que la commande est en brouillon
    const commande = await prisma.commandeFournisseur.findUnique({
      where: { id },
      select: { statut: true }
    })

    if (!commande) {
      return notFound('Commande introuvable')
    }

    if (commande.statut !== 'BROUILLON') {
      return badRequest('Seules les commandes en brouillon peuvent être supprimées')
    }

    await prisma.commandeFournisseurLigne.deleteMany({ where: { commandeId: id } })
    await prisma.commandeFournisseur.delete({ where: { id } })
        return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
