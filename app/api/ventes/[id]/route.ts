import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference, deleteEcrituresByReferenceForIds } from '@/lib/delete-ecritures'
import { logSuppression, logModification, getIpAddress } from '@/lib/audit'
import {
  montantLigneTTC,
  montantTotalVenteDocument,
  pointsFideliteDepuisEncaissement,
} from '@/lib/calculs-commerciaux'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'

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
      client: { select: { id: true, nom: true, telephone: true, type: true, adresse: true, ncc: true } },
      lignes: {
        include: { produit: { select: { id: true, code: true, designation: true } } },
      },
      reglements: true,
      ReglementVenteLigne: { select: { montant: true } },
    },
  })

  if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })

  if (session!.role !== 'SUPER_ADMIN' && vente.entiteId !== session!.entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const totalLignePaye = (vente.ReglementVenteLigne || []).reduce((s, l) => s + (l.montant || 0), 0)
  const venteWithRealPaye = {
    ...vente,
    montantPaye: Math.max(totalLignePaye, vente.montantPaye || 0),
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
  
  // VERROU DE SÉCURITÉ : Seul le SUPER_ADMIN peut supprimer définitivement une trace de vente.
  if (session!.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur peut supprimer une vente définitivement pour garantir la traçabilité.' }, { status: 403 })
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

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('VENTE', id, tx)
      // VENTE_REGLEMENT entries use reglementId as referenceId, not venteId
      if (v.reglements.length > 0) {
        await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', v.reglements.map((r: any) => r.id), tx)
      }
      await deleteEcrituresByReference('VENTE_STOCK', id, tx)
      await deleteEcrituresByReference('VENTE_FRAIS', id, tx)

// 2/3. Stock : éviter le double retour si la vente a déjà été annulée.
       await tx.mouvement.deleteMany({
           where: {
             OR: [
               { observation: `Annulation vente ${v.numero}` },
               { observation: `Vente ${v.numero}` },
               { observation: `Modif Vente ${v.numero}` }
             ]
           }
         })
        if (v.statut !== 'ANNULEE') {
          for (const l of v.lignes) {
            await tx.stock.updateMany({
              where: { produitId: l.produitId, magasinId: v.magasinId, entiteId: v.entiteId },
              data: { quantite: { increment: l.quantite } },
            })
          }
        }

       // 4. Nettoyage Trésorerie : CAISSE (y compris écritures d'annulation)
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: `Vente ${v.numero}` },
            { motif: `Règlement Vente ${v.numero}` },
            { motif: `ANNULATION VENTE ${v.numero}` }
          ]
        }
      })

      // 5. Nettoyage Trésorerie : BANQUE (y compris opérations d'annulation)
      const allBanqueRefs = [
        v.numero,
        `ANN-${v.numero}`
      ]
      const opsBancaires = await tx.operationBancaire.findMany({
        where: {
          reference: { in: allBanqueRefs }
        }
      })
      for (const op of opsBancaires) {
        const estEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(op.type.toUpperCase())
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
        })
      }
      await tx.operationBancaire.deleteMany({
        where: {
          reference: { in: allBanqueRefs }
        }
      })

      // 6. Supprimer règlements et vente
      await tx.reglementVenteLigne.deleteMany({ where: { venteId: id } })
      await tx.reglementVente.deleteMany({ where: { venteId: id } })
      await tx.vente.delete({ where: { id: id } })

// 7. LOG D'AUDIT : Mouchard de suppression (Capture intégrale pour restauration)
      await logSuppression(
        session, 
        'VENTE', 
        id, 
        `SUPPRESSION RADICALE : Facture ${v.numero} effacée avec régul. stocks et trésorerie par Super Admin`, 
        v, // Snapshot complet
        getIpAddress(_request)
      )

      // 8. Recalculer le solde caisse après suppression
      await recalculerSoldeCaisse(v.magasinId, tx)
    }, { timeout: 30000 })
    
    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/ventes')
    revalidatePath('/api/ventes')
    
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/ventes/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
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
    const action = body?.action || (body?.lignes ? 'FULL_UPDATE' : 'PAGEMENT')

    if (action === 'PAGEMENT') {
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
        include: { client: { select: { nom: true } }, magasin: true, ReglementVenteLigne: { select: { montant: true } } }
      })

      if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
      if (session!.role !== 'SUPER_ADMIN' && vente.entiteId !== session!.entiteId) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
      }

      const totalFromLignes = (vente.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
      const realMontantPaye = Math.max(totalFromLignes, vente.montantPaye || 0)
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
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
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

        const { comptabiliserReglementVente } = await import('@/lib/comptabilisation')
        await comptabiliserReglementVente({
          venteId: vente.id,
          numeroVente: vente.numero,
          date: dateReglement,
          montant: montantReglementApplique,
          modePaiement,
          utilisateurId: session!.userId,
          entiteId: vente.entiteId,
          magasinId: vente.magasinId
        }, tx)

        return updatedVente
      }, { timeout: 20000 })

      revalidatePath('/dashboard/ventes')
      revalidatePath('/api/ventes')
      return NextResponse.json(result)
    }

    if (action === 'FULL_UPDATE') {
      const { clientId, date, magasinId, observation, lignes, modePaiement, reglements, clientLibre, remiseGlobale, fraisApproche } = body
      
      const result = await prisma.$transaction(async (tx: any) => {
        const oldVente = await tx.vente.findUnique({
          where: { id },
          include: { lignes: true, reglements: true }
        })
        if (!oldVente) throw new Error("Vente introuvable")
        if (oldVente.statut === 'ANNULEE') throw new Error("Vente annulée ne peut plus être modifiée")

        // VERROU COMPTABLE : Interdiction de modifier une vente de plus de 24h (Sauf Super_Admin)
        const diffHeures = (new Date().getTime() - new Date(oldVente.date).getTime()) / (1000 * 3600)
        if (diffHeures > 24 && session!.role !== 'SUPER_ADMIN') {
          throw new Error("Verrou Comptable : Cette vente date de plus de 24h. Modification interdite pour garantir l'intégrité des calculs. Veuillez contacter le Super Administrateur ou procéder à une Annulation.")
        }

        // 1. Rollback stocks
        for (const l of oldVente.lignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: oldVente.magasinId, entiteId: oldVente.entiteId },
            data: { quantite: { increment: l.quantite } }
          })
}
         await tx.mouvement.deleteMany({
           where: {
             OR: [
               { observation: `Annulation vente ${oldVente.numero}` },
               { observation: `Vente ${oldVente.numero}` },
               { observation: `Modif Vente ${oldVente.numero}` }
             ]
           }
         })

        // 2. Nettoyer compta, règlements auto et caisse
        await deleteEcrituresByReference('VENTE', id, tx)
        if (oldVente.reglements.length > 0) {
          await deleteEcrituresByReferenceForIds('VENTE_REGLEMENT', oldVente.reglements.map((r: any) => r.id), tx)
        }
        await deleteEcrituresByReference('VENTE_STOCK', id, tx)
        await deleteEcrituresByReference('VENTE_FRAIS', id, tx)
await tx.reglementVenteLigne.deleteMany({ where: { venteId: id } })
        await tx.reglementVente.deleteMany({ where: { venteId: id } })
        // On supprime les mouvements de caisse liés exactement à ce numéro
        await tx.caisse.deleteMany({ 
          where: { 
            OR: [
              { motif: `Vente ${oldVente.numero}` },
              { motif: `Règlement Vente ${oldVente.numero}` },
            ]
          } 
        })
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

          const st = await tx.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: currentMagasinId, entiteId: oldVente.entiteId } } })
          if ((st?.quantite ?? 0) < q) throw new Error(`Stock insuffisant pour ${p.designation}`)
        }

        const globalRem = Math.max(0, Number(remiseGlobale || 0))
        const finalFrais = Math.max(0, Number(fraisApproche || oldVente.fraisApproche || 0))
        const totalFinal = montantTotalVenteDocument(newTotalHT, globalRem, finalFrais)
        
        // Gestion Multi-Paiement
        const regsData = Array.isArray(reglements) ? reglements : []
        const mntPaye = regsData.reduce((acc: number, r: any) => acc + (Number(r.montant) || 0), 0)

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

        // 5. Appliquer stocks
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

        // 6. Règlements (Multi ou Simple) + synchro trésorerie
        if (mntPaye > 0 || regsData.length > 0) {
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
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
            await tx.reglementVenteLigne.create({
              data: {
                reglementId: regl.id,
                venteId: updated.id,
                montant: mntR,
              }
            })
            // Synchro physique trésorerie
            const modeR = String(r.mode).toUpperCase()
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
              const { enregistrerOperationBancaire } = await import('@/lib/banque')
              await enregistrerOperationBancaire({
                banqueId: r.banqueId ? Number(r.banqueId) : null,
                entiteId: updated.entiteId,
                date: updated.date,
                type: 'REGLEMENT_CLIENT',
                libelle: `Règlement Vente ${updated.numero}`,
                montant: mntR,
                utilisateurId: session!.userId,
                reference: updated.numero,
                beneficiaire: updated.clientLibre || null,
              }, tx)
            }
          }
        }

        // 7. Comptabilisation (dans la transaction)
        const { comptabiliserVente } = await import('@/lib/comptabilisation')
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

        // 8. LOG D'AUDIT
        await logModification(session!, 'VENTE', updated.id, `Mise à jour complète de la facture ${updated.numero}`, oldVente, updated, getIpAddress(request))

        return updated
      }, { timeout: 30000 })

      revalidatePath('/dashboard/ventes')
      revalidatePath('/api/ventes')
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 })
  } catch (e: any) {
    console.error('PATCH /api/ventes/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}
