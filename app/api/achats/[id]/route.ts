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
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const achat = await prisma.achat.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      fournisseur: { select: { id: true, nom: true, telephone: true, email: true, localisation: true, ncc: true } },
      lignes: true,
    },
  })

  if (!achat) {
    return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    const entiteId = await getEntiteId(session)
    if (achat.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
  }

  return NextResponse.json(achat)
}

/** Suppression définitive (Super Admin uniquement). Annule les stocks et supprime les écritures comptables. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // VERROU DE SÉCURITÉ : Seul le SUPER_ADMIN peut supprimer définitivement une trace d'achat.
  if (session.role !== 'SUPER_ADMIN') {
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
        include: { lignes: true },
      })
      if (!a) throw new Error('Achat introuvable.')

      // 1. Nettoyer compta
      await deleteEcrituresByReference('ACHAT', id, tx)

      // 2. Nettoyage des mouvements de stocks (Entrées à annuler)
      await tx.mouvement.deleteMany({
        where: { observation: { contains: a.numero } }
      })

      // 3. Retrait des produits du stock (décrément car c'était un achat)
      for (const l of a.lignes) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: a.magasinId },
          data: { quantite: { decrement: l.quantite } }
        })
      }

      // 4. Nettoyage Trésorerie
      await tx.caisse.deleteMany({
        where: { motif: { contains: a.numero } }
      })

      // Re-ajustement banque
      const regls = await tx.reglementAchat.findMany({ where: { achatId: id } })
      for (const r of regls) {
        if (['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(r.modePaiement)) {
          const banque = await tx.banque.findFirst({ where: { actif: true } })
          if (banque) {
            await tx.banque.update({
              where: { id: banque.id },
              data: { soldeActuel: { increment: r.montant } } // Remboursement de banque
            })
          }
        }
      }

      // 5. Supprimer règlements et achat
      await tx.reglementAchat.deleteMany({ where: { achatId: id } })
      await tx.achat.delete({ where: { id: id } })
      
      // 6. LOG D'AUDIT : Mouchard de suppression (Indélébile)
      await logSuppression(session, 'ACHAT', id, `Suppression d'achat fournisseur ${a.numero}`, { numero: a.numero, montant: a.montantTotal }, getIpAddress(_request))
    }, { timeout: 20000 })
    
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  try {
    const body = await request.json()
    const action = body?.action || (body?.lignes ? 'FULL_UPDATE' : 'PAGEMENT')

    if (action === 'PAGEMENT') {
      const montantReglement = Math.max(0, Number(body?.montant) || 0)
      const modePaiement = body?.modePaiement || 'ESPECES'

      if (montantReglement <= 0) {
        return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
      }

      const achat = await prisma.achat.findUnique({
        where: { id },
        include: { magasin: true }
      })

      if (!achat) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })

      const nouveauMontantPaye = Math.min(achat.montantTotal, (achat.montantPaye || 0) + montantReglement)
      const nouveauStatut = nouveauMontantPaye >= achat.montantTotal ? 'PAYE' : 'PARTIEL'

      const updatedAchat = await prisma.achat.update({
        where: { id },
        data: {
          montantPaye: nouveauMontantPaye,
          statutPaiement: nouveauStatut
        }
      })

      await prisma.reglementAchat.create({
        data: {
          achatId: id,
          fournisseurId: achat.fournisseurId!,
          montant: montantReglement,
          modePaiement: modePaiement,
          utilisateurId: session.userId,
          date: new Date(),
          observation: `Paiement sur facture ${achat.numero}`
        }
      })

      const { comptabiliserReglementAchat } = await import('@/lib/comptabilisation')
      await comptabiliserReglementAchat({
        achatId: achat.id,
        numeroAchat: achat.numero,
        date: new Date(),
        montant: montantReglement,
        modePaiement: modePaiement,
        utilisateurId: session.userId,
        magasinId: achat.magasinId,
        entiteId: achat.entiteId,
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
        if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
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
          where: { observation: { contains: oldAchat.numero } }
        })

        // 2. Nettoyer compta et règlements auto
        await deleteEcrituresByReference('ACHAT', id, tx)
        await tx.reglementAchat.deleteMany({ where: { achatId: id } })
        // On supprime tout mouvement de caisse lié à ce numéro de commande/facture
        await tx.caisse.deleteMany({ 
          where: { 
            OR: [
              { motif: { contains: oldAchat.numero } },
            ]
          } 
        })

        // 3. Valider nouvelles lignes
        let newTotalHT = 0
        const nouvellesLignes: any[] = []
        const currentMagasinId = Number(magasinId || oldAchat.magasinId)

        for (const l of lignes) {
          const p = await tx.produit.findUnique({ where: { id: Number(l.produitId) } })
          if (!p) throw new Error(`Produit ${l.produitId} introuvable`)
          
          const q = Math.max(0, Number(l.quantite))
          const pu = Math.max(0, Number(l.prixUnitaire))
          const tva = Math.max(0, Number(l.tva || 0))
          const rem = Math.max(0, Number(l.remise || 0))
          const mnt = Math.round((q * pu - rem) * (1 + tva / 100))
          
          newTotalHT += mnt
          nouvellesLignes.push({
            produitId: p.id,
            designation: p.designation,
            quantite: q,
            prixUnitaire: pu,
            tva,
            remise: rem,
            montant: mnt
          })
        }

        const fApprocheTotal = Math.max(0, Number(fraisApproche || 0))
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
            montantTotal: newTotalHT,
            fraisApproche: fApprocheTotal,
            montantPaye: Math.min(newTotalHT, mntPaye),
            statutPaiement: mntPaye >= newTotalHT ? 'PAYE' : mntPaye > 0 ? 'PARTIEL' : 'CREDIT',
            modePaiement: regsData.length > 1 ? 'MULTI' : (regsData[0]?.mode || modePaiement || oldAchat.modePaiement),
            lignes: {
              deleteMany: {},
              create: nouvellesLignes
            }
          },
          include: { 
            lignes: true,
            magasin: { select: { id: true, code: true, nom: true } },
            fournisseur: { select: { id: true, nom: true, code: true } }
          }
        })

        // 5. Appliquer nouveaux stocks (Entrée) + MAJ PAMP
        // Calcul du prorata des frais d'approche par ligne
        const ratioFrais = newTotalHT > 0 ? fApprocheTotal / newTotalHT : 0

        for (const l of nouvellesLignes) {
          const product = await tx.produit.findUnique({ where: { id: l.produitId } })
          const stock = await tx.stock.findUnique({ 
            where: { produitId_magasinId: { produitId: l.produitId, magasinId: updated.magasinId } } 
          })

          const qteStockAvant = stock?.quantite || 0
          const puNetWithFrais = l.prixUnitaire + (l.prixUnitaire * ratioFrais)
          
          // Nouveau PAMP = (Valeur Stock Actuel + Valeur Nouvel Achat) / Quantité Totale
          // On considère le stock comme 0 s'il est négatif pour ne pas fausser le PAMP
          const valeurStockActuel = Math.max(0, qteStockAvant) * (product?.pamp || product?.prixAchat || 0)
          const valeurNouvelAchat = l.quantite * puNetWithFrais
          const nouvelleQteTotal = Math.max(0, qteStockAvant) + l.quantite
          
          const nouveauPamp = Math.round((valeurStockActuel + valeurNouvelAchat) / nouvelleQteTotal)

          await tx.produit.update({
            where: { id: l.produitId },
            data: { pamp: nouveauPamp }
          })

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
              utilisateurId: session.userId,
              quantite: l.quantite,
              observation: `Modif Achat ${updated.numero}`,
            }
          })
        }

        // 6. Règlements (Multi ou Simple)
        if (mntPaye > 0 || regsData.length > 0) {
          for (const r of regsData) {
            const mntR = Number(r.montant) || 0
            if (mntR <= 0) continue
            await tx.reglementAchat.create({
              data: {
                achatId: updated.id,
                fournisseurId: updated.fournisseurId,
                montant: mntR,
                modePaiement: r.mode,
                utilisateurId: session.userId,
                observation: `Modif Achat ${updated.numero}`,
                date: updated.date,
              }
            })
          }
        }

        // 7. LOG D'AUDIT : Mouchard de modification
        await logModification(session, 'ACHAT', updated.id, `Mise à jour complète de l'achat ${updated.numero}`, oldAchat, updated, getIpAddress(request))

        return updated
      }, { timeout: 15000 })

      // 7. Comptabiliser
      const { comptabiliserAchat } = await import('@/lib/comptabilisation')
      await comptabiliserAchat({
        achatId: result.id,
        numeroAchat: result.numero,
        date: result.date,
        montantTotal: result.montantTotal,
        fraisApproche: result.fraisApproche,
        modePaiement: result.modePaiement,
        fournisseurId: result.fournisseurId,
        utilisateurId: session.userId,
        magasinId: result.magasinId,
        entiteId: result.entiteId,
        reglements: body.reglements || [],
        lignes: result.lignes,
      })

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
