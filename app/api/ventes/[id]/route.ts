import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { logSuppression, logModification, getIpAddress } from '@/lib/audit'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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
    },
  })

  if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })

  if (session.role !== 'SUPER_ADMIN') {
    const entiteId = await getEntiteId(session)
    if (vente.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
  }

  return NextResponse.json(vente)
}

/** Suppression définitive (Super Admin uniquement). Annule les stocks et supprime les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // VERROU DE SÉCURITÉ : Seul le SUPER_ADMIN peut supprimer définitivement une trace de vente.
  if (session.role !== 'SUPER_ADMIN') {
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
      await deleteEcrituresByReference('VENTE_REGLEMENT', id, tx)
      await deleteEcrituresByReference('VENTE_STOCK', id, tx)
      await deleteEcrituresByReference('VENTE_FRAIS', id, tx)

      // 2. Nettoyage des mouvements de stocks (Annulation de la sortie)
      await tx.mouvement.deleteMany({
        where: { observation: { contains: v.numero } }
      })

      // 3. Retour des produits au stock (Incrément)
      for (const l of v.lignes) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: v.magasinId },
          data: { quantite: { increment: l.quantite } },
        })
      }

      // 4. Nettoyage Trésorerie : CAISSE
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: { contains: v.numero } },
            { motif: { contains: `VENTE ${v.numero}` } }
          ]
        }
      })

      // 5. Nettoyage Trésorerie : BANQUE (Opérations Bancaires)
      // On cherche les opérations bancaires liées au numéro de vente
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { reference: v.numero }
      })

      for (const op of opsBancaires) {
        // MAJ du solde de la banque concernée (on soustrait le montant car c'était une entrée)
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: { decrement: op.montant } }
        })
        // Suppression de l'opération
        await tx.operationBancaire.delete({ where: { id: op.id } })
      }

      // 6. Supprimer règlements et vente
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  try {
    const body = await request.json()
    const action = body?.action || (body?.lignes ? 'FULL_UPDATE' : 'PAGEMENT')

    if (action === 'PAGEMENT') {
      const montantReglement = Math.max(0, Number(body?.montant) || 0)
      const modePaiement = body?.modePaiement || 'ESPECES'
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
        include: { magasin: true }
      })

      if (!vente) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })

      const result = await prisma.$transaction(async (tx) => {
        const nouveauMontantPaye = Math.min(vente.montantTotal, (vente.montantPaye || 0) + montantReglement)
        const nouveauStatut = nouveauMontantPaye >= vente.montantTotal ? 'PAYE' : 'PARTIEL'

        const updatedVente = await tx.vente.update({
          where: { id },
          data: {
            montantPaye: nouveauMontantPaye,
            statutPaiement: nouveauStatut
          }
        })

        if (vente.clientId) {
          await tx.reglementVente.create({
            data: {
              venteId: id,
              clientId: vente.clientId,
              montant: montantReglement,
              modePaiement,
              utilisateurId: session.userId,
              date: dateReglement,
              observation: body?.observation || `Paiement sur facture ${vente.numero}`
            }
          })
        }

        const { comptabiliserReglementVente } = await import('@/lib/comptabilisation')
        await comptabiliserReglementVente({
          venteId: vente.id,
          numeroVente: vente.numero,
          date: dateReglement,
          montant: montantReglement,
          modePaiement,
          utilisateurId: session.userId,
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
          include: { lignes: true }
        })
        if (!oldVente) throw new Error("Vente introuvable")
        if (oldVente.statut === 'ANNULEE') throw new Error("Vente annulée ne peut plus être modifiée")

        // VERROU COMPTABLE : Interdiction de modifier une vente de plus de 24h (Sauf Super_Admin)
        const diffHeures = (new Date().getTime() - new Date(oldVente.date).getTime()) / (1000 * 3600)
        if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
          throw new Error("Verrou Comptable : Cette vente date de plus de 24h. Modification interdite pour garantir l'intégrité des calculs. Veuillez contacter le Super Administrateur ou procéder à une Annulation.")
        }

        // 1. Rollback stocks
        for (const l of oldVente.lignes) {
          await tx.stock.updateMany({
            where: { produitId: l.produitId, magasinId: oldVente.magasinId },
            data: { quantite: { increment: l.quantite } }
          })
        }
        await tx.mouvement.deleteMany({
          where: { observation: { contains: oldVente.numero } }
        })

        // 2. Nettoyer compta, règlements auto et caisse
        await deleteEcrituresByReference('VENTE', id, tx)
        await tx.reglementVente.deleteMany({ where: { venteId: id } })
        // On supprime tout mouvement de caisse lié à ce numéro de facture (ou bon) pour éviter les doublons
        await tx.caisse.deleteMany({ 
          where: { 
            OR: [
              { motif: { contains: oldVente.numero } },
              { motif: { contains: oldVente.numeroBon || '___X___' } }
            ]
          } 
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
          const mnt = Math.round((q * pu - rem) * (1 + tva / 100))
          
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

          const st = await tx.stock.findUnique({ where: { produitId_magasinId: { produitId: p.id, magasinId: currentMagasinId } } })
          if ((st?.quantite ?? 0) < q) throw new Error(`Stock insuffisant pour ${p.designation}`)
        }

        const globalRem = Math.max(0, Number(remiseGlobale || 0))
        const finalFrais = Math.max(0, Number(fraisApproche || oldVente.fraisApproche || 0))
        const totalFinal = Math.max(0, newTotalHT - globalRem + finalFrais)
        
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
            where: { produitId: l.produitId, magasinId: updated.magasinId },
            data: { quantite: { decrement: l.quantite } }
          })
          await tx.mouvement.create({
            data: {
              type: 'SORTIE',
              produitId: l.produitId,
              magasinId: updated.magasinId,
              entiteId: updated.entiteId,
              utilisateurId: session.userId,
              quantite: l.quantite,
              observation: `Modif Vente ${updated.numero}`,
            }
          })
        }

        // 6. Règlements (Multi ou Simple)
        if (mntPaye > 0 || regsData.length > 0) {
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
            await tx.reglementVente.create({
              data: {
                venteId: updated.id,
                clientId: updated.clientId, // Peut être null si clientLibre
                montant: mntR,
                modePaiement: r.mode,
                utilisateurId: session.userId,
                observation: `Modif Vente ${updated.numero}`,
                date: updated.date,
              }
            })
          }
        }

        // 7. LOG D'AUDIT : Mouchard de modification
        await logModification(session, 'VENTE', updated.id, `Mise à jour complète de la facture ${updated.numero}`, oldVente, updated, getIpAddress(request))

        return updated
      }, { timeout: 30000 })

      // 7. Comptabiliser
      const { comptabiliserVente } = await import('@/lib/comptabilisation')
      await comptabiliserVente({
        venteId: result.id,
        numeroVente: result.numero,
        date: result.date,
        montantTotal: result.montantTotal,
        modePaiement: result.modePaiement,
        clientId: result.clientId,
        entiteId: result.entiteId,
        utilisateurId: session.userId,
        magasinId: result.magasinId,
        reglements: body.reglements || [],
        fraisApproche: result.fraisApproche || 0,
        lignes: result.lignes,
      })

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
