import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { deleteEcrituresByReference, deleteEcrituresByReferenceForIds } from '@/lib/delete-ecritures'
import { logSuppression, logModification, getIpAddress } from '@/lib/audit'
import {
  montantLigneTTC,
  montantTotalVenteDocument,
  pointsFideliteDepuisEncaissement,
} from '@/lib/calculs-commerciaux'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque, enregistrerOperationBancaire } from '@/lib/banque'
import { comptabiliserLivraisonCommande, comptabiliserReglementVente, comptabiliserVente } from '@/lib/comptabilisation'
import { verifierCloture } from '@/lib/cloture'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { venteSchema } from '@/lib/validations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  const authError = requirePermission(session, 'ventes:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const vente = await prisma.vente.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true, localisation: true } },
      client: { select: { id: true, code: true, nom: true, telephone: true, type: true, adresse: true, ncc: true } },
      lignes: {
        include: { produit: { select: { id: true, code: true, designation: true } } },
      },
      reglements: true,
      ReglementVenteLigne: { select: { reglementId: true, montant: true } },
    },
  })

  if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })

  if (session!.role !== 'SUPER_ADMIN' && vente.entiteId !== session!.entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const creditReglementIds = new Set(
    (vente.reglements || [])
      .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
      .map(r => r.id)
  )
  const totalLignePaye = (vente.ReglementVenteLigne || [])
    .filter(l => !creditReglementIds.has(l.reglementId))
    .reduce((s, l) => s + (l.montant || 0), 0)
  const venteWithRealPaye = {
    ...vente,
    montantPaye: totalLignePaye > 0 ? totalLignePaye : (vente.montantPaye || 0),
    reglements: vente.reglements?.map((r: any) => {
      const { ReglementVenteLigne, ...rest } = r
      return rest
    }),
    ReglementVenteLigne: undefined,
  }

  return NextResponse.json(venteWithRealPaye)
}

/** Suppression définitive (Super Admin uniquement). Annule les stocks et supprime les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  if (session!.role !== 'SUPER_ADMIN' && session!.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur ou l\'Administrateur peut supprimer une vente.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const v = await tx.vente.findUnique({
        where: { id },
        include: { lignes: true, reglements: true },
      })
      if (!v) throw new Error('Vente introuvable.')

      await verifierCloture(v.date, session, tx)

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('VENTE', id, tx)
      // VENTE_REGLEMENT : les écritures sont stockées avec referenceId = venteId (et non reglementId)
      // On nettoie par venteId en plus des reglementIds pour être sûr
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)
      if (v.reglements.length > 0) {
        await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', v.reglements.map((r: any) => r.id), tx)
      }
      await deleteEcrituresByReference('VENTE_STOCK', id, tx)
      await deleteEcrituresByReference('VENTE_FRAIS', id, tx)
      // Nettoyer les écritures de livraison de commande (COMMANDE_LIVRAISON)
      await deleteEcrituresByReference('COMMANDE_LIVRAISON', id, tx)

      // 2/3. Stock
      const totalLivree = v.lignes.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
      const estCommande = v.typeVente === 'COMMANDE'
      const stockPasDeduit = (estCommande || v.retraitDiffere) && totalLivree === 0
      const stockADeduire = !stockPasDeduit
      if (stockADeduire) {
        await tx.mouvement.deleteMany({
          where: {
            OR: [
              { observation: `Annulation vente ${v.numero}` },
              { observation: `Vente ${v.numero}` },
              { observation: `Modif Vente ${v.numero}` },
              { observation: `Livraison commande ${v.numero}` },
              { observation: `Retrait vente ${v.numero}` },
            ]
          }
        })
        if (v.statut !== 'ANNULEE') {
          for (const l of v.lignes) {
            const qteARembourser = estCommande || v.retraitDiffere ? (l.quantiteLivree || 0) : l.quantite
            if (qteARembourser > 0) {
              await tx.stock.updateMany({
                where: { produitId: l.produitId, magasinId: v.magasinId, entiteId: v.entiteId },
                data: { quantite: { increment: qteARembourser } },
              })
            }
          }
        }
      }

      // 4. Supprimer retours associés (inverser leur effet stock avant)
      const retours = await tx.retour.findMany({
        where: { venteId: id },
        include: { lignes: true },
      })
      for (const r of retours) {
        for (const l of r.lignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: v.magasinId, entiteId: v.entiteId },
            data: { quantite: { decrement: l.quantite } },
          })
        }
      }

      const retourRefs = retours.map((r: any) => r.numero)

      // 5. Nettoyage Trésorerie : CAISSE (y compris écritures retour)
      const caissesSupprimees = await tx.caisse.findMany({
        where: { OR: [{ motif: `VENTE ${v.numero}` }, { motif: `RÈGLEMENT VENTE ${v.numero}` }, { motif: `ANNULATION VENTE ${v.numero}` }, { motif: { contains: `sur vente ${v.numero}` } }] },
        select: { id: true }
      })
      const caisseIds = caissesSupprimees.map((c: any) => c.id)
      if (caisseIds.length > 0) {
        await tx.ecritureComptable.deleteMany({ where: { referenceType: 'CAISSE', referenceId: { in: caisseIds } } })
      }
      await tx.caisse.deleteMany({ where: { id: { in: caisseIds } } })

      // 6. Nettoyage Trésorerie : BANQUE (y compris opérations retour)
      const allBanqueRefs = [v.numero, `ANN-${v.numero}`, ...retourRefs]
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { reference: { in: allBanqueRefs } },
        select: { id: true, banqueId: true, montant: true, type: true }
      })
      for (const op of opsBancaires) {
        const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
        })
      }
      const banqueOpIds = opsBancaires.map((op: any) => op.id)
      if (banqueOpIds.length > 0) {
        await tx.ecritureComptable.deleteMany({ where: { referenceType: 'BANQUE_OPERATION', referenceId: { in: banqueOpIds } } })
      }
      await tx.operationBancaire.deleteMany({ where: { id: { in: banqueOpIds } } })

      // 7. Supprimer retours
      await tx.retour.deleteMany({ where: { venteId: id } })

      // 7. Supprimer règlements et vente
      await tx.reglementVenteLigne.deleteMany({ where: { venteId: id } })
      await tx.reglementVente.deleteMany({ where: { venteId: id } })
      await tx.vente.delete({ where: { id: id } })

// 8. LOG D'AUDIT : Mouchard de suppression (Capture intégrale pour restauration)
      await logSuppression(
        session, 
        'VENTE', 
        id, 
        `SUPPRESSION RADICALE : Facture ${v.numero} effacée avec régul. stocks et trésorerie par Super Admin`, 
        v, // Snapshot complet
        getIpAddress(_request)
      )

      // 9. Recalculer le solde caisse après suppression
      await recalculerSoldeCaisse(v.magasinId, tx)
    }, { timeout: 30000 })
    
    // Invalider le cache pour affichage immédiat
            return NextResponse.json({ success: true })
  } catch (e) {
    await apiCatch(e, 'api/ventes/[id]')
    return NextResponse.json({ error: (e as Error).message || 'Erreur serveur.' }, { status: 500 })
  }
}

/** Mise à jour de la vente (Règlement OU Modification complète des lignes) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'ventes:edit')
  if (authError) return authError

  const id = Number((await params).id)
  try {
    const body = await request.json()
    const action = body?.action || (body?.lignes ? 'FULL_UPDATE' : 'PAIEMENT')

    // RETRAIT_PARTIEL et LIVRER ont leur propre validation inline, pas besoin de venteSchema
    if (action !== 'RETRAIT_PARTIEL' && action !== 'LIVRER') {
      const vres = validateApiRequest(venteSchema.partial(), body)
      if (!vres.success) return vres.response
    }

    if (action === 'LIVRER') {
      const vente = await prisma.vente.findUnique({
        where: { id },
        include: { lignes: true, magasin: true, reglements: true }
      })
      if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
      if (vente.typeVente !== 'COMMANDE') {
        return NextResponse.json({ error: 'Seules les ventes sur commande peuvent être livrées.' }, { status: 400 })
      }
      if (vente.dateLivraison) {
        return NextResponse.json({ error: 'Cette commande a déjà été intégralement livrée.' }, { status: 400 })
      }

      const lignesPayload = Array.isArray(body?.lignes) ? body.lignes : null
      const maintenant = new Date()
      await prisma.$transaction(async (tx) => {
        let montantTotalLivraison = 0
        const lignesLivrees: any[] = []
        const deliveredMap = new Map<number, number>()

        for (const l of vente.lignes) {
          const resteALivrer = l.quantite - (l.quantiteLivree || 0)
          if (resteALivrer <= 0) continue

          let qteALivrer = lignesPayload
            ? Math.min(Math.max(0, Number(lignesPayload.find((p: any) => p.produitId === l.produitId)?.quantite) || 0), resteALivrer)
            : resteALivrer

          if (qteALivrer <= 0) continue

          const st = await tx.stock.findUnique({
            where: { produitId_magasinId_entiteId: { produitId: l.produitId, magasinId: vente.magasinId, entiteId: vente.entiteId } }
          })
          if ((st?.quantite ?? 0) < qteALivrer) {
            throw new Error(`Stock insuffisant pour ${l.designation} (${st?.quantite || 0} dispo, ${qteALivrer} requis).`)
          }
          await tx.stock.update({
            where: { produitId_magasinId_entiteId: { produitId: l.produitId, magasinId: vente.magasinId, entiteId: vente.entiteId } },
            data: { quantite: { decrement: qteALivrer } },
          })
          await tx.mouvement.create({
            data: {
              type: 'SORTIE', produitId: l.produitId, magasinId: vente.magasinId,
              entiteId: vente.entiteId, utilisateurId: session!.userId,
              quantite: qteALivrer, dateOperation: maintenant,
              observation: `Livraison commande ${vente.numero}`,
            },
          })
          await tx.venteLigne.update({
            where: { id: l.id },
            data: { quantiteLivree: { increment: qteALivrer } },
          })

          const montantLigne = (l.montant / l.quantite) * qteALivrer
          montantTotalLivraison += montantLigne
          lignesLivrees.push({
            produitId: l.produitId, designation: l.designation,
            quantite: qteALivrer, prixUnitaire: l.prixUnitaire,
            coutUnitaire: l.coutUnitaire, tva: l.tva, remise: l.remise,
          })
          deliveredMap.set(l.produitId, qteALivrer)
        }

        if (lignesLivrees.length === 0) {
          throw new Error('Aucune ligne à livrer.')
        }

        const toutesLivrees = vente.lignes.every((l: any) => {
          const already = l.quantiteLivree || 0
          const just = deliveredMap.get(l.produitId) || 0
          return (already + just) >= l.quantite
        })

        if (toutesLivrees) {
          await tx.vente.update({ where: { id }, data: { dateLivraison: maintenant } })
        }

        await comptabiliserLivraisonCommande({
          venteId: id, numeroVente: vente.numero, date: maintenant,
          montantTotal: montantTotalLivraison, entiteId: vente.entiteId,
          utilisateurId: session!.userId, magasinId: vente.magasinId,
          lignes: lignesLivrees,
        }, tx)
      }, { timeout: 20000 })

                  const msg = lignesPayload ? 'Livraison partielle effectuée avec succès.' : 'Commande livrée avec succès.'
      return NextResponse.json({ success: true, message: msg })
    }

    if (action === 'RETRAIT_PARTIEL') {
      const vente = await prisma.vente.findUnique({
        where: { id },
        include: { lignes: true, magasin: true }
      })
      if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
      if (!vente.retraitDiffere) {
        return NextResponse.json({ error: 'Cette vente n\'est pas à retrait différé.' }, { status: 400 })
      }

      const lignesRetrait: { produitId: number; quantite: number }[] = body?.lignes || []
      if (!lignesRetrait.length) {
        return NextResponse.json({ error: 'Aucune ligne à retirer.' }, { status: 400 })
      }

      const maintenant = new Date()
      let dateRetrait = maintenant
      if (body?.date) {
        const d = new Date(body.date)
        if (!Number.isNaN(d.getTime())) {
          dateRetrait = d
          if (String(body.date).length <= 10) {
            dateRetrait.setHours(maintenant.getHours(), maintenant.getMinutes(), maintenant.getSeconds())
          }
        }
      }

      return await prisma.$transaction(async (tx) => {
        let montantTotalRetrait = 0
        const lignesRetirees: any[] = []
        const lignesUpdate: { id: number; quantiteLivree: number }[] = []

        for (const lr of lignesRetrait) {
          const ligne = vente.lignes.find((l: any) => l.produitId === lr.produitId)
          if (!ligne) throw new Error(`Produit ID ${lr.produitId} introuvable dans la vente.`)

          const restant = ligne.quantite - (ligne.quantiteLivree || 0)
          if (lr.quantite <= 0) throw new Error('Quantité invalide.')
          if (lr.quantite > restant) {
            throw new Error(`Quantité retirée (${lr.quantite}) > restant à retirer (${restant}) pour ${ligne.designation}.`)
          }

          const st = await tx.stock.findUnique({
            where: { produitId_magasinId_entiteId: { produitId: lr.produitId, magasinId: vente.magasinId, entiteId: vente.entiteId } }
          })
          if ((st?.quantite ?? 0) < lr.quantite) {
            throw new Error(`Stock insuffisant pour ${ligne.designation} (${st?.quantite || 0} dispo, ${lr.quantite} requis).`)
          }

          await tx.stock.update({
            where: { produitId_magasinId_entiteId: { produitId: lr.produitId, magasinId: vente.magasinId, entiteId: vente.entiteId } },
            data: { quantite: { decrement: lr.quantite } },
          })
          await tx.mouvement.create({
            data: {
              type: 'SORTIE', produitId: lr.produitId, magasinId: vente.magasinId,
              entiteId: vente.entiteId, utilisateurId: session!.userId,
              quantite: lr.quantite, dateOperation: dateRetrait,
              observation: `Retrait vente ${vente.numero}`,
            },
          })

          const nouvelleQteLivree = (ligne.quantiteLivree || 0) + lr.quantite
          lignesUpdate.push({ id: ligne.id, quantiteLivree: nouvelleQteLivree })

          const ratio = lr.quantite / ligne.quantite
          const montantLigne = ligne.montant * ratio
          montantTotalRetrait += montantLigne
          lignesRetirees.push({
            produitId: lr.produitId, designation: ligne.designation,
            quantite: lr.quantite, prixUnitaire: ligne.prixUnitaire,
            coutUnitaire: ligne.coutUnitaire, tva: ligne.tva, remise: ligne.remise,
          })
        }

        for (const lu of lignesUpdate) {
          await tx.venteLigne.update({ where: { id: lu.id }, data: { quantiteLivree: lu.quantiteLivree } })
        }

        const lastNum = await tx.retraitPartiel.findFirst({
          where: { entiteId: vente.entiteId }, orderBy: { id: 'desc' }, select: { numero: true }
        })
        const nextNum = lastNum ? String(Number(lastNum.numero) + 1).padStart(6, '0') : '000001'

        await tx.retraitPartiel.create({
          data: {
            numero: nextNum,
            venteId: id,
            date: dateRetrait,
            utilisateurId: session!.userId,
            entiteId: vente.entiteId,
            lignes: {
              create: lignesRetirees.map((l: any) => ({
                produitId: l.produitId, designation: l.designation,
                quantite: l.quantite, prixUnitaire: l.prixUnitaire,
                montant: l.prixUnitaire * l.quantite,
              }))
            }
          }
        })

        await comptabiliserLivraisonCommande({
          venteId: id, numeroVente: vente.numero, date: dateRetrait,
          montantTotal: montantTotalRetrait, entiteId: vente.entiteId,
          utilisateurId: session!.userId, magasinId: vente.magasinId,
          lignes: lignesRetirees,
        }, tx)

        return NextResponse.json({ success: true, message: `Retrait partiel effectué (${lignesRetrait.length} produit(s)).` })
      }, { timeout: 20000 })
    }

    if (action === 'PAIEMENT') {
      const montantReglement = Math.max(0, Number(body?.montant) || 0)
      const modePaiement = body?.modePaiement || 'ESPECES'
      const banqueId = body?.banqueId ? Number(body.banqueId) : null
      const now = new Date()
      let dateReglement = body?.date ? new Date(body.date) : now
      // Si la date vient d'un sélecteur (YYYY-MM-DD), on ajoute l'heure actuelle
      if (body?.date && body.date.length <= 10) {
        dateReglement.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      }

      if (montantReglement <= 0) {
        return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
      }

      const vente = await prisma.vente.findUnique({
        where: { id },
        include: {
          client: { select: { nom: true } },
          magasin: true,
          reglements: { select: { id: true, modePaiement: true } },
          ReglementVenteLigne: { select: { reglementId: true, montant: true } },
          lignes: true,
        }
      })

      if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
      if (session!.role !== 'SUPER_ADMIN' && vente.entiteId !== session!.entiteId) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
      }

      const creditReglementIds = new Set(
        (vente.reglements || [])
          .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
          .map(r => r.id)
      )
      const totalFromLignes = (vente.ReglementVenteLigne || [])
        .filter(l => !creditReglementIds.has(l.reglementId))
        .reduce((s: number, l: any) => s + (l.montant || 0), 0)
      const realMontantPaye = totalFromLignes > 0 ? totalFromLignes : (vente.montantPaye || 0)
      const resteAPayer = Math.max(0, (vente.montantTotal || 0) - realMontantPaye)
      if (montantReglement - resteAPayer > 1) {
        return NextResponse.json({
          error: `Paiement invalide : le montant (${montantReglement.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`
        }, { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
        let nouveauMontantPaye = Math.min(vente.montantTotal, realMontantPaye + montantReglement)
        if (vente.montantTotal - nouveauMontantPaye > 0 && vente.montantTotal - nouveauMontantPaye <= 1) {
          nouveauMontantPaye = vente.montantTotal
        }
        const nouveauStatut = nouveauMontantPaye >= vente.montantTotal ? 'PAYE' : 'PARTIEL'
        const montantReglementApplique = nouveauMontantPaye - realMontantPaye

        const updatedVente = await tx.vente.update({
          where: { id },
          data: {
            montantPaye: nouveauMontantPaye,
            statutPaiement: nouveauStatut
          }
        })

        // Créer le règlement avec le montant effectivement appliqué
        const reglement = await tx.reglementVente.create({
          data: {
            venteId: id,
            clientId: vente.clientId,
            entiteId: vente.entiteId,
            montant: montantReglementApplique,
            modePaiement,
            utilisateurId: session!.userId,
            date: dateReglement,
            observation: body?.observation || `Paiement sur facture ${vente.numero}`
          }
        })

        await tx.reglementVenteLigne.create({
          data: {
            reglementId: reglement.id,
            venteId: id,
            montant: montantReglementApplique,
          }
        })

        if (vente.clientId) {
          const client = await tx.client.findUnique({
            where: { id: vente.clientId },
            select: { id: true, code: true }
          })
          if (client && client.code !== 'PASSAGE' && client.code !== 'ANONYME') {
            await tx.client.update({
              where: { id: client.id },
              data: { pointsFidelite: { increment: pointsFideliteDepuisEncaissement(montantReglementApplique) } }
            })
          }
        }

        // ✅ SYNCHRO PHYSIQUE (Caisse ou Banque) - avec le montant appliqué
        if (estModeEspeces(modePaiement)) {
          await enregistrerMouvementCaisse({
            magasinId: vente.magasinId,
            type: 'ENTREE',
            motif: `Règlement Vente ${vente.numero}`,
            montant: montantReglementApplique,
            utilisateurId: session!.userId,
            entiteId: vente.entiteId,
            date: dateReglement,
          }, tx)
          await recalculerSoldeCaisse(vente.magasinId, tx)
        } else if (estModeBanque(modePaiement)) {
          if (!banqueId || !Number.isFinite(banqueId)) {
            throw new Error('Banque requise pour les règlements non espèces.')
          }
          await enregistrerOperationBancaire({
            banqueId,
            entiteId: vente.entiteId,
            date: dateReglement,
            type: 'REGLEMENT_CLIENT',
            libelle: `Règlement Vente ${vente.numero}`,
            montant: montantReglementApplique,
            utilisateurId: session!.userId,
            reference: vente.numero,
            beneficiaire: vente.client?.nom || vente.clientLibre || null,
            observation: `Paiement via ${modePaiement}`,
          }, tx)
        }

        const totalLivreePaiement = vente.lignes.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
        const totalQte = vente.lignes.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0)
        const retraitDiffereNonFini = vente.retraitDiffere && totalLivreePaiement < totalQte
        const isCommandeNonLivree = (vente.typeVente === 'COMMANDE' && !vente.dateLivraison) || retraitDiffereNonFini
        await comptabiliserReglementVente({
          reglementId: reglement.id,
          venteId: vente.id,
          numeroVente: vente.numero,
          date: dateReglement,
          montant: montantReglementApplique,
          modePaiement,
          utilisateurId: session!.userId,
          entiteId: vente.entiteId,
          magasinId: vente.magasinId,
          estAcompte: isCommandeNonLivree,
        }, tx)

        return updatedVente
      }, { timeout: 20000 })

                  return NextResponse.json(result)
    }

    if (action === 'FULL_UPDATE') {
      const { clientId, date, magasinId, observation, lignes, modePaiement, reglements, clientLibre, remiseGlobale, fraisApproche, typeVente, dateLivraison, retraitDiffere, banqueId } = body
      
      const preCheck = await prisma.vente.findUnique({ where: { id }, select: { updatedAt: true } })
      if (!preCheck) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
      
      const result = await prisma.$transaction(async (tx: any) => {
        const oldVente = await tx.vente.findUnique({
          where: { id },
          include: { lignes: true, reglements: true }
        })
        if (!oldVente) throw new Error("Vente introuvable")
        if (oldVente.updatedAt.getTime() !== preCheck.updatedAt.getTime()) {
          throw new Error("Conflit de concurrence : Cette vente a été modifiée par un autre utilisateur. Veuillez recharger et réessayer.")
        }
        if (oldVente.statut === 'ANNULEE') throw new Error("Vente annulée ne peut plus être modifiée")

        // VERROU COMPTABLE : Interdiction de modifier une vente de plus de 24h (Sauf Super_Admin)
        const diffHeures = (new Date().getTime() - new Date(oldVente.date).getTime()) / (1000 * 3600)
        if (diffHeures > 24 && session!.role !== 'SUPER_ADMIN') {
          throw new Error("Verrou Comptable : Cette vente date de plus de 24h. Modification interdite pour garantir l'intégrité des calculs. Veuillez contacter le Super Administrateur ou procéder à une Annulation.")
        }

        const totalLivreeVente = oldVente.lignes.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
        const stockPasDeduit = (oldVente.typeVente === 'COMMANDE' && totalLivreeVente === 0) || (oldVente.retraitDiffere && totalLivreeVente === 0)
        const estCommandeNonLivree = stockPasDeduit

        // 1. Rollback stocks (uniquement si stock déjà déduit)
        if (!estCommandeNonLivree) {
          for (const l of oldVente.lignes) {
            const qteARembourser = l.quantiteLivree || 0
            if (qteARembourser > 0) {
              await tx.stock.updateMany({
                where: { produitId: l.produitId, magasinId: oldVente.magasinId, entiteId: oldVente.entiteId },
                data: { quantite: { increment: qteARembourser } }
              })
            }
          }
          await tx.mouvement.deleteMany({
             where: {
               OR: [
                 { observation: `Annulation vente ${oldVente.numero}` },
                 { observation: `Vente ${oldVente.numero}` },
                 { observation: `Modif Vente ${oldVente.numero}` },
                 { observation: `Livraison commande ${oldVente.numero}` },
                 { observation: `Retrait vente ${oldVente.numero}` },
               ]
             }
           })
        }

        // 2. Nettoyer compta, règlements auto et caisse
        await deleteEcrituresByReference('VENTE', id, tx)
        await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)
        if (oldVente.reglements.length > 0) {
          await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', oldVente.reglements.map((r: any) => r.id), tx)
        }
        await deleteEcrituresByReference('VENTE_STOCK', id, tx)
        await deleteEcrituresByReference('VENTE_FRAIS', id, tx)
        await deleteEcrituresByReference('COMMANDE_LIVRAISON', id, tx)

        const regsData = Array.isArray(reglements) && reglements.length > 0
          ? reglements
          : oldVente.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant, banqueId: r.banqueId }))

        if (regsData.length > 0) {
          await tx.reglementVenteLigne.deleteMany({ where: { venteId: id } })
          await tx.reglementVente.deleteMany({ where: { venteId: id } })
        }
        // On supprime les mouvements de caisse liés exactement à ce numéro
        await tx.caisse.deleteMany({ 
          where: { 
            OR: [
              { motif: `VENTE ${oldVente.numero}` },
              { motif: `RÈGLEMENT VENTE ${oldVente.numero}` },
              { motif: `FRAIS LOGISTIQUES VENTE ${oldVente.numero}` },
            ]
          } 
        })
        await recalculerSoldeCaisse(oldVente.magasinId, tx)
        // Supprimer les opérations bancaires liées à cette vente (inversion solde + suppression)
        const opsBancairesOld = await tx.operationBancaire.findMany({
          where: { reference: oldVente.numero }
        })
        for (const op of opsBancairesOld) {
          const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
          })
        }
        await tx.operationBancaire.deleteMany({
          where: { reference: oldVente.numero }
        })

        // 3. Valider nouvelles lignes
        let newTotalHT = 0
        const lignesAcreer: any[] = []
        const currentMagasinId = Number(magasinId || oldVente.magasinId)

        const oldQtys: Record<number, number> = {}
        for (const ol of oldVente.lignes) {
          oldQtys[ol.produitId] = (oldQtys[ol.produitId] || 0) + ol.quantite
        }

        for (const l of lignes) {
          const p = await tx.produit.findUnique({ where: { id: Number(l.produitId) } })
          if (!p) throw new Error(`Produit ${l.produitId} introuvable`)

          const q = Math.max(0, Number(l.quantite))
          const pu = Math.max(0, Number(l.prixUnitaire))
          const tva = Math.max(0, Number(l.tva || 0))
          const rem = Math.max(0, Number(l.remise || 0))

          const prixMin = p.prixMinimum || 0
          if (prixMin > 0 && pu < prixMin) {
            throw new Error(`Action interdite : Le prix pour ${p.designation} (${pu.toLocaleString('fr-FR')} F) est inférieur au prix minimum de sécurité (${prixMin.toLocaleString('fr-FR')} F).`)
          }

          const mnt = montantLigneTTC({
            quantite: q,
            prixUnitaire: pu,
            remiseLigne: rem,
            tvaPourcent: tva,
          })
          
          newTotalHT += mnt
          lignesAcreer.push({
            produitId: p.id,
            designation: p.designation,
            quantite: q,
            prixUnitaire: pu,
            coutUnitaire: p.pamp || p.prixAchat || 0,
            tva,
            remise: rem,
            montant: mnt
          })

          if (!estCommandeNonLivree) {
            const oldQty = oldQtys[Number(l.produitId)] || 0
            if (q > oldQty && session!.role !== 'SUPER_ADMIN') {
              const besoinSupplementaire = q - oldQty
              const st = await tx.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: currentMagasinId, entiteId: oldVente.entiteId } } })
              if ((st?.quantite ?? 0) < besoinSupplementaire) throw new Error(`Stock insuffisant pour ${p.designation}`)
            }
          }
        }

        const globalRem = Math.max(0, Number(remiseGlobale || 0))
        const finalFrais = Math.max(0, Number(fraisApproche || oldVente.fraisApproche || 0))
        const totalFinal = montantTotalVenteDocument(newTotalHT, globalRem, finalFrais)
        
        // Gestion Multi-Paiement
        const mntPaye = regsData.reduce((acc: number, r: any) => {
          if (String(r.mode).toUpperCase() === 'CREDIT') return acc
          return acc + (Number(r.montant) || 0)
        }, 0)

        // Gestion de la date : préserver l'heure d'origine si seule la date change
        let dateFinale = oldVente.date
        if (date) {
            const newDate = new Date(date)
            // Si la date reçue n'a pas d'heure (format YYYY-MM-DD), on fusionne avec l'heure existante
            if (date.length <= 10) {
              newDate.setHours(oldVente.date.getHours(), oldVente.date.getMinutes(), oldVente.date.getSeconds())
            }
            dateFinale = newDate
        }

        // 4. Update
        const updated = await tx.vente.update({
          where: { id },
          data: {
            clientId: clientId ? Number(clientId) : null,
            clientLibre: clientLibre || null,
            date: dateFinale,
            magasinId: currentMagasinId,
            modePaiement: regsData.length > 1 ? 'MULTI' : (regsData[0]?.mode || modePaiement || oldVente.modePaiement),
            observation: observation || null,
            numeroBon: body.numeroBon || null,
            montantTotal: totalFinal,
            fraisApproche: finalFrais,
            remiseGlobale: globalRem,
            typeVente: typeVente || oldVente.typeVente,
            dateLivraison: dateLivraison ? new Date(dateLivraison) : oldVente.typeVente === 'LIVRAISON_IMMEDIATE' ? null : oldVente.dateLivraison,
            retraitDiffere: retraitDiffere === true,
            montantPaye: Math.min(totalFinal, mntPaye),
            statutPaiement: mntPaye >= totalFinal ? 'PAYE' : mntPaye > 0 ? 'PARTIEL' : 'CREDIT',
            lignes: {
              deleteMany: {},
              create: lignesAcreer
            }
          },
          include: { 
            lignes: true,
            magasin: { select: { id: true, code: true, nom: true } },
            client: { select: { id: true, nom: true } }
          }
        })

        // 5. Appliquer stocks (uniquement si pas une commande non livrée)
        if (!estCommandeNonLivree) {
          for (const l of lignesAcreer) {
            await tx.stock.updateMany({
              where: { produitId: l.produitId, magasinId: updated.magasinId, entiteId: updated.entiteId },
              data: { quantite: { decrement: l.quantite } }
            })
            await tx.mouvement.create({
              data: {
                type: 'SORTIE',
                produitId: l.produitId,
                magasinId: updated.magasinId,
                entiteId: updated.entiteId,
                utilisateurId: session!.userId,
                quantite: l.quantite,
                observation: `Modif Vente ${updated.numero}`,
              }
            })
          }
        }

        // 5b. Points de fidélité
        if (updated.clientId || oldVente.clientId) {
          const oldPts = pointsFideliteDepuisEncaissement(oldVente.montantPaye || 0)
          const newPts = pointsFideliteDepuisEncaissement(updated.montantPaye || 0)
          if (oldVente.clientId && oldPts > 0) {
            const oldCli = await tx.client.findUnique({ where: { id: oldVente.clientId }, select: { code: true } })
            if (oldCli && oldCli.code !== 'PASSAGE' && oldCli.code !== 'ANONYME') {
              await tx.client.update({ where: { id: oldVente.clientId }, data: { pointsFidelite: { decrement: oldPts } } }).catch(() => {})
            }
          }
          if (updated.clientId && newPts > 0) {
            const newCli = await tx.client.findUnique({ where: { id: updated.clientId }, select: { code: true } })
            if (newCli && newCli.code !== 'PASSAGE' && newCli.code !== 'ANONYME') {
              await tx.client.update({ where: { id: updated.clientId }, data: { pointsFidelite: { increment: newPts } } }).catch(() => {})
            }
          }
        }

        // 6. Règlements (Multi ou Simple) + synchro trésorerie
        const reglementIds: number[] = []
        if (mntPaye > 0 || regsData.length > 0) {
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
            const modeR = String(r.mode).toUpperCase()
            if (modeR === 'CREDIT') continue
            const regl = await tx.reglementVente.create({
              data: {
                venteId: updated.id,
                clientId: updated.clientId,
                entiteId: updated.entiteId,
                montant: mntR,
                modePaiement: r.mode,
                utilisateurId: session!.userId,
                observation: `Modif Vente ${updated.numero}`,
                date: updated.date,
              }
            })
            reglementIds.push(regl.id)
            await tx.reglementVenteLigne.create({
              data: {
                reglementId: regl.id,
                venteId: updated.id,
                montant: mntR,
              }
            })
            // Synchro physique trésorerie
            if (estModeEspeces(modeR)) {
              await enregistrerMouvementCaisse({
                magasinId: updated.magasinId,
                type: 'ENTREE',
                motif: `Règlement Vente ${updated.numero}`,
                montant: mntR,
                utilisateurId: session!.userId,
                entiteId: updated.entiteId,
                date: updated.date,
              }, tx)
              await recalculerSoldeCaisse(updated.magasinId, tx)
            } else if (estModeBanque(modeR)) {
              await enregistrerOperationBancaire({
                banqueId: r.banqueId ? Number(r.banqueId) : null,
                entiteId: updated.entiteId,
                date: updated.date,
                type: 'REGLEMENT_CLIENT',
                libelle: `Règlement Vente ${updated.numero}`,
                montant: mntR,
                utilisateurId: session!.userId,
                reference: updated.numero,
                beneficiaire: updated.client?.nom || updated.clientLibre || null,
              }, tx)
            }
          }
        }

        // 7. Comptabilisation
        if (!estCommandeNonLivree) {
          await comptabiliserVente({
            venteId: updated.id,
            numeroVente: updated.numero,
            date: updated.date,
            montantTotal: updated.montantTotal,
            modePaiement: updated.modePaiement,
            clientId: updated.clientId,
            entiteId: updated.entiteId,
            utilisateurId: session!.userId,
            magasinId: updated.magasinId,
            reglements: regsData.map((r: any) => ({ mode: r.mode, montant: Number(r.montant) || 0 })),
            fraisApproche: updated.fraisApproche || 0,
            lignes: updated.lignes,
          }, tx)
        } else {
          // COMMANDE non livrée : comptabiliser les règlements en avance (4191)
          let regIdx = 0
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
            const modeR = String(r.mode).toUpperCase()
            if (modeR === 'CREDIT') continue
            await comptabiliserReglementVente({
              reglementId: reglementIds[regIdx] || undefined,
              venteId: updated.id,
              numeroVente: updated.numero,
              date: updated.date,
              montant: mntR,
              modePaiement: r.mode,
              utilisateurId: session!.userId,
              entiteId: updated.entiteId,
              magasinId: updated.magasinId,
              estAcompte: true,
            }, tx)
            regIdx++
          }
        }

        return { updated, oldVente }
      }, { timeout: 30000 })

      // 8. LOG D'AUDIT (hors transaction pour éviter les conflits de client Prisma)
      await logModification(session!, 'VENTE', result.updated.id, `Mise à jour complète de la facture ${result.updated.numero}`, result.oldVente, result.updated, getIpAddress(request))

                  return NextResponse.json(result.updated)
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 })
  } catch (e: any) {
    await apiCatch(e, 'api/ventes/[id]')
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}
