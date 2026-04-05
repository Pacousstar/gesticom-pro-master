import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  const commande = await prisma.commandeFournisseur.findUnique({
    where: { id },
    include: {
      fournisseur: { select: { id: true, nom: true, telephone: true, localisation: true, ncc: true } },
      magasin: { select: { id: true, code: true, nom: true } },
      lignes: true
    }
  })

  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  return NextResponse.json(commande)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  try {
    const body = await request.json()
    const entiteId = await getEntiteId(session)

    // Modification complète (Full Update)
    if (body.lignes) {
      await prisma.$transaction([
        // 1. Supprimer les anciennes lignes
        prisma.commandeFournisseurLigne.deleteMany({ where: { commandeId: id } }),
        // 2. Mettre à jour les infos et recréer les lignes
        prisma.commandeFournisseur.update({
          where: { id },
          data: {
            date: body.date ? new Date(body.date) : undefined,
            fournisseurId: body.fournisseurId ? Number(body.fournisseurId) : null,
            fournisseurLibre: body.fournisseurLibre,
            magasinId: body.magasinId ? Number(body.magasinId) : undefined,
            montantTotal: Number(body.montantTotal),
            observation: body.observation,
            statut: body.statut,
            lignes: {
              create: body.lignes.map((l: any) => ({
                produitId: Number(l.produitId),
                designation: l.designation,
                quantite: Number(l.quantite),
                prixUnitaire: Number(l.prixUnitaire),
                montant: Number(l.montant)
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
          observation: body.observation
        }
      })
    }

    revalidatePath('/dashboard/commandes-fournisseurs')
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('PATCH /api/commandes-fournisseurs:', e)
    return NextResponse.json({ error: 'Erreur lors de la modification.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  try {
    // Les lignes seront supprimées via cascade si configuré, sinon deleteMany avant
    await prisma.commandeFournisseurLigne.deleteMany({ where: { commandeId: id } })
    await prisma.commandeFournisseur.delete({ where: { id } })
    revalidatePath('/dashboard/commandes-fournisseurs')
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur suppression.' }, { status: 500 })
  }
}
