import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { logAction, getIpAddress } from '@/lib/audit'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { handleApiError, unauthorized, badRequest, notFound } from '@/lib/api-error'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const { id } = await params
    const venteId = Number(id)
    if (!Number.isInteger(venteId) || venteId < 1) return badRequest('ID vente invalide.')

    const entiteId = await getEntiteId(session)
    if (!entiteId) return badRequest('Entité non identifiée.')

    const vente = await prisma.vente.findUnique({ where: { id: venteId }, select: { id: true, entiteId: true } })
    if (!vente) return notFound('Vente introuvable.')
    if (vente.entiteId !== entiteId) return badRequest('Accès refusé à cette vente.')

    const retours = await prisma.retour.findMany({
      where: { venteId, entiteId },
      include: {
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
        utilisateur: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(retours)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  const permError = requirePermission(session, 'ventes:create')
  if (permError) return permError

  try {
    const { id } = await params
    const venteId = Number(id)
    if (!Number.isInteger(venteId) || venteId < 1) return badRequest('ID vente invalide.')

    const body = await request.json()
    const lignesRetour: { produitId: number; quantite: number }[] = body.lignes || []
    const remboursement = body.remboursement !== false
    const modeRemboursement = body.modeRemboursement || 'ESPECES'
    const observation = body.observation?.trim() || null

    if (!lignesRetour.length) return badRequest('Au moins un produit à retourner requis.')

    const MODES_VALIDES = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT']
    if (!MODES_VALIDES.includes(modeRemboursement)) return badRequest('Mode de remboursement invalide.')
    if (modeRemboursement !== 'ESPECES' && !body.banqueId) return badRequest('Veuillez sélectionner un compte bancaire.')

    const entiteId = await getEntiteId(session)
    if (!entiteId) return badRequest('Entité non identifiée.')

    const vente = await prisma.vente.findUnique({
      where: { id: venteId },
      include: { lignes: true, client: { select: { id: true, nom: true } }, magasin: { select: { id: true } } }
    })
    if (!vente) return badRequest('Vente introuvable.')
    if (vente.entiteId !== entiteId) return badRequest('Accès refusé à cette vente.')
    if (vente.statut === 'ANNULEE') return badRequest('Vente annulée.')
    if (vente.typeVente === 'COMMANDE' && !vente.dateLivraison) {
      return badRequest('Commande non livrée : impossible de retourner du stock. Annulez la commande plutôt.')
    }

    const retour = await prisma.$transaction(async (tx: any) => {
      const lignesAretourner: any[] = []
      let montantTotal = 0

      const retoursExistants = await tx.retour.findMany({
        where: { venteId },
        select: { lignes: { select: { produitId: true, quantite: true } } },
      })
      const qteDejaRetournee: Record<number, number> = {}
      for (const r of retoursExistants) {
        for (const rl of r.lignes) {
          qteDejaRetournee[rl.produitId] = (qteDejaRetournee[rl.produitId] || 0) + rl.quantite
        }
      }

      for (const l of lignesRetour) {
        const ligneOrigine = vente.lignes.find((vl: any) => vl.produitId === l.produitId)
        if (!ligneOrigine) throw new Error(`Produit ID ${l.produitId} non trouvé dans la vente.`)

        const qte = Math.max(0, Number(l.quantite))
        if (qte <= 0) continue
        const maxRestant = ligneOrigine.quantite - (qteDejaRetournee[l.produitId] || 0)
        if (qte > maxRestant) throw new Error(
          `Quantité retournée (${qte}) > quantité restante retournable (${maxRestant}) pour ${ligneOrigine.designation} (déjà ${qteDejaRetournee[l.produitId] || 0} retournée(s)).`
        )

        const montantLigne = Math.round((ligneOrigine.montant / ligneOrigine.quantite) * qte * 100) / 100
        montantTotal += montantLigne

        lignesAretourner.push({
          produitId: l.produitId,
          designation: ligneOrigine.designation,
          quantite: qte,
          prixUnitaire: ligneOrigine.prixUnitaire,
          tva: ligneOrigine.tva,
          remise: ligneOrigine.remise,
          montant: montantLigne,
        })

        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: vente.magasinId, entiteId },
          data: { quantite: { increment: qte } },
        })
        await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            produitId: l.produitId,
            magasinId: vente.magasinId,
            entiteId,
            utilisateurId: session.userId,
            quantite: qte,
            dateOperation: new Date(),
            observation: `Retour client - Vente ${vente.numero}`,
          },
        })
      }

      if (!lignesAretourner.length) throw new Error('Aucun produit valide à retourner.')

      const now = Date.now()
      const retour = await tx.retour.create({
        data: {
          numero: `RT${now}`,
          venteId,
          clientId: vente.clientId,
          magasinId: vente.magasinId,
          entiteId,
          utilisateurId: session.userId,
          montantTotal,
          observation,
          estRembourse: remboursement,
          lignes: {
            create: lignesAretourner,
          },
        },
      })

      if (remboursement) {
        const motifRetour = `Remboursement retour ${retour.numero} sur vente ${vente.numero}`
        if (estModeEspeces(modeRemboursement)) {
          const mvtCaisse = await enregistrerMouvementCaisse({
            magasinId: vente.magasinId,
            type: 'SORTIE',
            motif: motifRetour,
            montant: montantTotal,
            utilisateurId: session.userId,
            entiteId,
            date: new Date(),
            sousType: 'RETOUR',
          }, tx)
          await recalculerSoldeCaisse(vente.magasinId, tx)
          if (mvtCaisse) {
            const { comptabiliserCaisse } = await import('@/lib/comptabilisation')
            await comptabiliserCaisse({
              caisseId: mvtCaisse.id,
              date: new Date(),
              type: 'SORTIE',
              montant: montantTotal,
              motif: motifRetour,
              utilisateurId: session.userId,
              entiteId,
              sousType: 'RETOUR',
            }, tx)
          }
        } else {
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
          if (body.banqueId) {
            const opBancaire = await enregistrerOperationBancaire({
              banqueId: Number(body.banqueId),
              entiteId,
              date: new Date(),
              type: 'RETOUR_CLIENT',
              libelle: `Remboursement retour Vente ${vente.numero}`,
              montant: montantTotal,
              utilisateurId: session.userId,
              reference: retour.numero,
              beneficiaire: vente.client?.nom || 'Client',
            }, tx)
            if (opBancaire) {
              const { comptabiliserOperationBancaire } = await import('@/lib/comptabilisation')
              await comptabiliserOperationBancaire({
                operationId: opBancaire.id,
                banqueId: Number(body.banqueId),
                date: new Date(),
                type: 'RETOUR_CLIENT',
                montant: montantTotal,
              libelle: motifRetour,
                compteId: null,
                utilisateurId: session.userId,
                entiteId,
              }, tx)
            }
          }
        }
      }

      const ip = getIpAddress(request)
      await logAction(session, 'RETOUR', 'VENTE',
        `Retour de ${montantTotal.toLocaleString('fr-FR')} F sur vente ${vente.numero} (${lignesAretourner.length} produit(s))`,
        venteId, { retourId: retour.id, montant: montantTotal }, ip
      )

      return retour
    }, { timeout: 20000 })

    revalidatePath('/dashboard/ventes')
    revalidatePath('/api/ventes')

    return NextResponse.json(retour)
  } catch (e) {
    return handleApiError(e)
  }
}
