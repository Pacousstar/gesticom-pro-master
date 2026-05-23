import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import type { Session } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { logSuppression, logModification, getIpAddress } from '@/lib/audit'
import { montantLigneTTC, htNetLigne, partFraisApprocheLigne, valeurAchatNetAvecFrais, nouveauPampApresAchatLigne } from '@/lib/calculs-commerciaux'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession() as Session
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  const authError = requirePermission(session, 'achats:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

const achat = await prisma.achat.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true, localisation: true } },
      fournisseur: { select: { id: true, nom: true, telephone: true, adresse: true, ncc: true } },
      lignes: true,
      reglements: true,
      ReglementAchatLigne: { select: { montant: true } },
    },
  })

  if (!achat) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })

  if (session!.role !== 'SUPER_ADMIN' && achat.entiteId !== session!.entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const totalLignePaye = (achat.ReglementAchatLigne as any[] || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
  const achatWithRealPaye = {
    ...achat,
    montantPaye: Math.max(totalLignePaye, achat.montantPaye || 0),
    ReglementAchatLigne: undefined,
  }

  return NextResponse.json(achatWithRealPaye)
}

/** Suppression définitive (Super Admin uniquement). Annule les stocks et supprime les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // VERROU DE SÉCURITÉ : Seul le SUPER_ADMIN peut supprimer définitivement une trace d'achat.
  if (session!.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur peut supprimer un achat définitivement pour garantir la traçabilité des stocks.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const a = await tx.achat.findUnique({
        where: { id },
        include: { lignes: true, reglements: true },
      })
      if (!a) throw new Error('Achat introuvable.')

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('ACHAT', id, tx)
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)
      await deleteEcrituresByReference('ACHAT_STOCK', id, tx)

      // 2/3. Stock : éviter le double retour si l'achat a déjà été annulé.
       if (a.statut !== 'ANNULEE') {
         await tx.mouvement.deleteMany({
           where: {
             OR: [
               { observation: `Achat ${a.numero}` },
               { observation: `Modif Achat ${a.numero}` }
             ]
           }
         })
        for (const l of a.lignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: a.magasinId },
            data: { quantite: { decrement: l.quantite } },
          })
        }
      }

      // 4. Nettoyage Trésorerie : CAISSE (correspondance exacte, pas de contains)
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: `Achat ${a.numero}` },
            { motif: `Règlement Achat ${a.numero}` }
          ]
        }
      })

      // 5. Nettoyage Trésorerie : BANQUE (Opérations Bancaires)
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { reference: a.numero }
      })

      const typesEntreeBanque = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU']
      for (const op of opsBancaires) {
        const estEntree = typesEntreeBanque.includes(op.type.toUpperCase())
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: estEntree ? { decrement: op.montant } : { increment: op.montant } }
        })
        await tx.operationBancaire.delete({ where: { id: op.id } })
      }

      // 6. Supprimer règlements et achat
      await tx.reglementAchatLigne.deleteMany({ where: { achatId: id } })
      await tx.reglementAchat.deleteMany({ where: { achatId: id } })
      await tx.achat.delete({ where: { id: id } })
      
      // 7. LOG D'AUDIT : Mouchard de suppression (Indélébile)
      await logSuppression(session, 'ACHAT', id, `SUPPRESSION RADICALE : Achat fournisseur ${a.numero} effacé avec régul. stocks et trésorerie par Super Admin`, { numero: a.numero, montant: a.montantTotal }, getIpAddress(_request))
    }, { timeout: 30000 })
    
    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/achats')
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/achats')
    
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/achats/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

/** Mise à jour de l'achat (Règlement OU Modification complète des lignes) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'achats:edit')
  if (authError) return authError

  const id = Number((await params).id)
  try {
    const body = await request.json()
    const action = body?.action || (body?.lignes ? 'FULL_UPDATE' : 'PAGEMENT')

    if (action === 'PAGEMENT') {
      const montantReglement = Math.max(0, Number(body?.montant) || 0)
      const modePaiement = (body?.modePaiement || 'ESPECES').toUpperCase()
      // CREDIT = dette à terme, ne peut pas être ajouté via un règlement (c'est une créance fournisseur)
      if (modePaiement === 'CREDIT') {
        return NextResponse.json({ error: 'Le mode CREDIT représente une dette à terme. Utilisez un véritable mode de paiement.' }, { status: 400 })
      }
      const banqueId = body?.banqueId ? Number(body.banqueId) : null
      const now = new Date()
      let dateReglement = body?.date ? new Date(body.date) : now
      if (isNaN(dateReglement.getTime())) dateReglement = now
      // Si la date vient d'un sélecteur (YYYY-MM-DD), on ajoute l'heure actuelle
      if (body?.date && String(body.date).length <= 10) {
        dateReglement.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      }

      if (montantReglement <= 0) {
        return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
      }

      const achat = await prisma.achat.findUnique({
        where: { id },
        include: { magasin: true, ReglementAchatLigne: { select: { montant: true } } }
      })

      if (!achat) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })
      if (session!.role !== 'SUPER_ADMIN' && achat.entiteId !== session!.entiteId) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
      }

      const totalLignePaye = (achat.ReglementAchatLigne as any[] || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
      const realMontantPaye = Math.max(totalLignePaye, achat.montantPaye || 0)
      const resteAPayer = Math.max(0, (achat.montantTotal || 0) - realMontantPaye)
      if (montantReglement - resteAPayer > 1) {
        return NextResponse.json({
          error: `Paiement invalide : le montant (${montantReglement.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`
        }, { status: 400 })
      }

      const nouveauMontantPaye = Math.min(achat.montantTotal, (achat.montantPaye || 0) + montantReglement)
      const nouveauStatut = nouveauMontantPaye >= achat.montantTotal ? 'PAYE' : 'PARTIEL'

      const { estModeBanque, enregistrerOperationBancaire } = await import('@/lib/banque')
      const { estModeEspeces } = await import('@/lib/enums-commerce')
      const { comptabiliserReglementAchat } = await import('@/lib/comptabilisation')

      const updatedAchat = await prisma.$transaction(async (tx) => {
        const up = await tx.achat.update({
          where: { id },
          data: {
            montantPaye: nouveauMontantPaye,
            statutPaiement: nouveauStatut
          }
        })

const reglAchat = await tx.reglementAchat.create({
            data: {
              achatId: id,
              fournisseurId: achat.fournisseurId,
              entiteId: achat.entiteId,
              montant: montantReglement,
              modePaiement: modePaiement,
              utilisateurId: session!.userId,
              date: dateReglement,
              observation: `Paiement sur facture ${achat.numero}`
            }
          })

          await tx.reglementAchatLigne.create({
            data: {
              reglementId: reglAchat.id,
              achatId: id,
              montant: montantReglement,
            }
          })

        // ✅ SYNCHRO PHYSIQUE (Caisse ou Banque)
        if (estModeEspeces(modePaiement)) {
          await enregistrerMouvementCaisse({
            magasinId: achat.magasinId,
            type: 'SORTIE',
            motif: `Règlement Achat ${achat.numero}`,
            montant: montantReglement,
            utilisateurId: session!.userId,
            entiteId: achat.entiteId,
            date: dateReglement,
          }, tx)
          await recalculerSoldeCaisse(achat.magasinId, tx)
        } else if (estModeBanque(modePaiement)) {
          if (!banqueId || !Number.isFinite(banqueId)) {
            throw new Error('Banque requise pour les règlements non espèces.')
          }
          await enregistrerOperationBancaire({
            banqueId,
            entiteId: achat.entiteId,
            date: dateReglement,
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Règlement Achat ${achat.numero}`,
            montant: montantReglement,
            utilisateurId: session!.userId,
            reference: achat.numero,
            observation: `Paiement via ${modePaiement}`,
          }, tx)
        }

        await comptabiliserReglementAchat({
          achatId: achat.id,
          numeroAchat: achat.numero,
          date: dateReglement,
          montant: montantReglement,
          modePaiement: modePaiement,
          utilisateurId: session!.userId,
          magasinId: achat.magasinId,
          entiteId: achat.entiteId,
        }, tx)

        return up
      })

      revalidatePath('/dashboard/achats')
      revalidatePath('/api/achats')
      return NextResponse.json(updatedAchat)
    }

    if (action === 'FULL_UPDATE') {
      const { fournisseurId, date, magasinId, observation, lignes, modePaiement, reglements, fournisseurLibre, fraisApproche } = body
      
      const result = await prisma.$transaction(async (tx: any) => {
        const oldAchat = await tx.achat.findUnique({
          where: { id },
          include: { lignes: true }
        })
        if (!oldAchat) throw new Error("Achat introuvable")

        // VERROU COMPTABLE : Interdiction de modifier un achat de plus de 24h (Sauf Super_Admin)
        const diffHeures = (new Date().getTime() - new Date(oldAchat.date).getTime()) / (1000 * 3600)
        if (diffHeures > 24 && session!.role !== 'SUPER_ADMIN') {
          throw new Error("Verrou Comptable : Cet achat date de plus de 24h. Modification interdite pour garantir l'intégrité du PAMP. Veuillez contacter le Super Administrateur.")
        }

        // 1. Rollback stocks : Retirer les produits du stock car c'était une entrée
        for (const l of oldAchat.lignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: oldAchat.magasinId },
            data: { quantite: { decrement: l.quantite } }
          })
        }
        await tx.mouvement.deleteMany({
          where: {
            OR: [
              { observation: `Achat ${oldAchat.numero}` },
              { observation: `Modif Achat ${oldAchat.numero}` },
            ]
          }
        })

        // 2. Nettoyer compta et règlements auto
        await deleteEcrituresByReference('ACHAT', id, tx)
        await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)
        await deleteEcrituresByReference('ACHAT_STOCK', id, tx)
await tx.reglementAchat.deleteMany({ where: { achatId: id } })
        await tx.reglementAchatLigne.deleteMany({ where: { achatId: id } })
        // On supprime les mouvements de caisse liés exactement à ce numéro
        await tx.caisse.deleteMany({ 
          where: { 
            OR: [
              { motif: `Règlement Achat ${oldAchat.numero}` },
            ]
          } 
        })
        // Supprimer les opérations bancaires liées à cet achat
        const opsBancairesOld = await tx.operationBancaire.findMany({
          where: { reference: oldAchat.numero }
        })
        for (const op of opsBancairesOld) {
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: { increment: op.montant } }
          })
          await tx.operationBancaire.delete({ where: { id: op.id } })
        }

        // 3. Valider nouvelles lignes
        let newTotalTTC = 0
        let totalHTNet = 0
        const nouvellesLignes: any[] = []
        const currentMagasinId = Number(magasinId || oldAchat.magasinId)

        const magasinExists = await tx.magasin.findUnique({ where: { id: currentMagasinId } })
        if (!magasinExists) throw new Error('Magasin introuvable.')
        if (magasinExists.entiteId !== oldAchat.entiteId) throw new Error('Accès au magasin refusé (Entité différente).')

        for (const l of lignes) {
          const p = await tx.produit.findUnique({ where: { id: Number(l.produitId) } })
          if (!p) throw new Error(`Produit ${l.produitId} introuvable`)
          
          const q = Math.max(0, Number(l.quantite))
          const pu = Math.max(0, Number(l.prixUnitaire))
          const tva = Math.max(0, Number(l.tva || 0))
          const rem = Math.max(0, Number(l.remise || 0))

          if (q <= 0) continue
          if (pu <= 0) throw new Error(`Prix unitaire invalide pour ${p.designation} : doit être supérieur à 0.`)
          
          const htNet = htNetLigne(q, pu, rem)
          const mntTTC = montantLigneTTC({
            quantite: q,
            prixUnitaire: pu,
            remiseLigne: rem,
            tvaPourcent: tva,
          })
          
          newTotalTTC += mntTTC
          totalHTNet += htNet

          nouvellesLignes.push({
            produitId: p.id,
            designation: p.designation,
            quantite: q,
            prixUnitaire: pu,
            coutUnitaire: htNet / q,
            tva,
            remise: rem,
            montant: mntTTC,
            htNet: htNet
          })
        }

        const fApprocheTotal = Math.max(0, Number(fraisApproche || 0))
        const totalFinal = newTotalTTC + fApprocheTotal
        const regsData = Array.isArray(reglements) ? reglements : []
        const mntPaye = regsData.reduce((acc: number, r: any) => acc + (Number(r.montant) || 0), 0)

        // Gestion de la date : préserver l'heure d'origine si seule la date change
        let dateFinale = oldAchat.date
        if (date) {
          const newDate = new Date(date)
          // Si la date reçue n'a pas d'heure (format YYYY-MM-DD), on fusionne avec l'heure existante
          if (date.length <= 10) {
            newDate.setHours(oldAchat.date.getHours(), oldAchat.date.getMinutes(), oldAchat.date.getSeconds())
          }
          dateFinale = newDate
        }

        // 4. Update Header
        const updated = await tx.achat.update({
          where: { id },
          data: {
            fournisseurId: fournisseurId ? Number(fournisseurId) : null,
            fournisseurLibre: fournisseurLibre || null,
            date: dateFinale,
            magasinId: currentMagasinId,
            observation: observation || null,
            montantTotal: totalFinal,
            fraisApproche: fApprocheTotal,
            montantPaye: Math.min(totalFinal, mntPaye),
            statutPaiement: mntPaye >= totalFinal ? 'PAYE' : mntPaye > 0 ? 'PARTIEL' : 'CREDIT',
            modePaiement: regsData.length > 1 ? 'MULTI' : (regsData[0]?.mode || modePaiement || oldAchat.modePaiement),
            lignes: {
              deleteMany: {},
              create: nouvellesLignes.map(nl => {
                const { htNet, ...data } = nl
                return data
              })
            }
          },
          include: { 
            lignes: true,
            magasin: { select: { id: true, code: true, nom: true } },
            fournisseur: { select: { id: true, nom: true, code: true } }
          }
        })

        // 5. Appliquer nouveaux stocks (Entrée) + MAJ PAMP
        // Regrouper les lignes par produit pour calcul PAMP correct (stock pré-achat)
        const totalFrais = fApprocheTotal
        const lignesParProduit = new Map<number, { quantite: number; valeurAchatNet: number; prixUnitaireFallback: number }>()
        for (const l of nouvellesLignes) {
          const partFrais = partFraisApprocheLigne(l.htNet, totalHTNet, totalFrais)
          const valNet = valeurAchatNetAvecFrais(l.htNet, partFrais)
          const existing = lignesParProduit.get(l.produitId)
          if (existing) {
            existing.quantite += l.quantite
            existing.valeurAchatNet += valNet
          } else {
            lignesParProduit.set(l.produitId, { quantite: l.quantite, valeurAchatNet: valNet, prixUnitaireFallback: l.prixUnitaire })
          }
        }

        for (const [produitId, groupe] of lignesParProduit) {
          const product = await tx.produit.findUnique({ where: { id: produitId }, include: { stocks: true } })
          if (product) {
            const stockGlobalAvant = product.stocks.reduce((acc: number, s: any) => acc + s.quantite, 0)
            const pampActuel = product.pamp || product.prixAchat || 0

            const pampAjuste = nouveauPampApresAchatLigne({
              stockGlobalAvant,
              pampActuel,
              quantiteLigne: groupe.quantite,
              valeurAchatNet: groupe.valeurAchatNet,
              prixUnitaireFallback: groupe.prixUnitaireFallback,
            })

            await tx.produit.update({
              where: { id: produitId },
              data: { pamp: pampAjuste }
            })
          }
        }

        for (const l of nouvellesLignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: updated.magasinId },
            data: { quantite: { increment: l.quantite } }
          })

          await tx.mouvement.create({
            data: {
              type: 'ENTREE',
              produitId: l.produitId,
              magasinId: updated.magasinId,
              entiteId: updated.entiteId,
              utilisateurId: session!.userId,
              quantite: l.quantite,
              dateOperation: updated.date,
              observation: `Modif Achat ${updated.numero}`,
            }
          })
        }

        // 6. Règlements (Multi ou Simple) + synchro trésorerie
        if (mntPaye > 0 || regsData.length > 0) {
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
            const reglA = await tx.reglementAchat.create({
              data: {
                achatId: updated.id,
                fournisseurId: updated.fournisseurId,
                entiteId: updated.entiteId,
                montant: mntR,
                modePaiement: r.mode,
                utilisateurId: session!.userId,
                observation: `Modif Achat ${updated.numero}`,
                date: updated.date,
              }
            })
            await tx.reglementAchatLigne.create({
              data: {
                reglementId: reglA.id,
                achatId: updated.id,
                montant: mntR,
              }
            })
            // Synchro physique trésorerie
            const modeR = String(r.mode).toUpperCase()
            if (estModeEspeces(modeR)) {
              await enregistrerMouvementCaisse({
                magasinId: updated.magasinId,
                type: 'SORTIE',
                motif: `Règlement Achat ${updated.numero}`,
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
                type: 'REGLEMENT_FOURNISSEUR',
                libelle: `Règlement Achat ${updated.numero}`,
                montant: mntR,
                utilisateurId: session!.userId,
                reference: updated.numero,
              }, tx)
            }
          }
        }

        // 7. Comptabilisation (dans la transaction)
        const { comptabiliserAchat } = await import('@/lib/comptabilisation')
        await comptabiliserAchat({
          achatId: updated.id,
          numeroAchat: updated.numero,
          date: updated.date,
          montantTotal: updated.montantTotal,
          fraisApproche: updated.fraisApproche,
          modePaiement: updated.modePaiement,
          fournisseurId: updated.fournisseurId,
          utilisateurId: session!.userId,
          magasinId: updated.magasinId,
          entiteId: updated.entiteId,
          reglements: regsData.map((r: any) => ({ mode: r.mode, montant: Number(r.montant) || 0 })),
          lignes: updated.lignes,
        }, tx)

        // 8. LOG D'AUDIT
        await logModification(session!, 'ACHAT', updated.id, `Mise à jour complète de l'achat ${updated.numero}`, oldAchat, updated, getIpAddress(request))

        return updated
      }, { timeout: 30000 })

      revalidatePath('/dashboard/achats')
      revalidatePath('/api/achats')
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 })
  } catch (e: any) {
    console.error('PATCH /api/achats/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}
