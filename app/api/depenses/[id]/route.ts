import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { logSuppression, getIpAddress } from '@/lib/audit'
import { verifierCloture } from '@/lib/cloture'
import { comptabiliserDepense } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { enregistrerOperationBancaire } from '@/lib/banque'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'depenses:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const depense = await prisma.depense.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      entite: { select: { code: true, nom: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  if (!depense) {
    return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })
  }

  // Sécurité Multi-Entité
  const entiteId = await getEntiteId(session)
  if (session.role !== 'SUPER_ADMIN' && depense.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  return NextResponse.json(depense)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'depenses:edit')
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const oldDepense = await prisma.depense.findUnique({ where: { id } })
    if (!oldDepense) return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })

    // Sécurité Multi-Entité
    if (session.role !== 'SUPER_ADMIN' && oldDepense.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // RD4: Vérifier la clôture avant modification
    await verifierCloture(oldDepense.date, session)

    const body = await request.json()

    const updateData: {
      date?: Date
      magasinId?: number | null
      categorie?: string
      libelle?: string
      montant?: number
      montantPaye?: number
      statutPaiement?: string
      modePaiement?: string
      beneficiaire?: string | null
      pieceJustificative?: string | null
      observation?: string | null
    } = {}

    if (body.date) {
      const newDate = new Date(body.date)
      if (body.date.length <= 10) {
        newDate.setHours(oldDepense.date.getHours(), oldDepense.date.getMinutes(), oldDepense.date.getSeconds())
      }
      updateData.date = newDate
    }
    if (body.magasinId !== undefined) {
      updateData.magasinId = body.magasinId != null ? Number(body.magasinId) : null
    }
    if (body.categorie) updateData.categorie = String(body.categorie).trim()
    if (body.libelle) updateData.libelle = String(body.libelle).trim()
    if (body.montant != null) updateData.montant = Math.max(0, Number(body.montant))

    // RD5: Normaliser le mode paiement
    if (body.modePaiement) {
      const modeNormalise = String(body.modePaiement).toUpperCase().trim()
      if (['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE', 'CREDIT'].includes(modeNormalise)) {
        updateData.modePaiement = modeNormalise
      }
    }

    if (body.montantPaye != null) updateData.montantPaye = Math.max(0, Number(body.montantPaye))
    if (body.beneficiaire !== undefined) updateData.beneficiaire = body.beneficiaire ? String(body.beneficiaire).trim() : null
    if (body.pieceJustificative !== undefined) updateData.pieceJustificative = body.pieceJustificative ? String(body.pieceJustificative).trim() : null
    if (body.observation !== undefined) updateData.observation = body.observation ? String(body.observation).trim() : null

    if (updateData.magasinId != null && updateData.magasinId > 0) {
      const magasin = await prisma.magasin.findUnique({ where: { id: updateData.magasinId } })
      if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
    }

    // Calcul du statut paiement
    if (updateData.montantPaye != null || updateData.montant != null) {
      const current = await prisma.depense.findUnique({ where: { id }, select: { montant: true, montantPaye: true } })
      if (current) {
        const total = updateData.montant ?? current.montant
        const paye = updateData.montantPaye ?? current.montantPaye ?? 0
        const payeClamp = Math.min(total, Math.max(0, paye))
        updateData.montantPaye = payeClamp
        updateData.statutPaiement = payeClamp >= total ? 'PAYE' : payeClamp > 0 ? 'PARTIEL' : 'CREDIT'
      }
    }

    // RD1 + RD2: Transaction pour mise à jour complète (comptabilité + trésorerie)
    const depense = await prisma.$transaction(async (tx) => {
      // Mise à jour de la dépense
      const d = await tx.depense.update({
        where: { id },
        data: updateData,
        include: {
          magasin: { select: { id: true, code: true, nom: true } },
          entite: { select: { code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })

      // RD1: Re-comptabiliser si la dépense est payée
      const shouldComptabiliser = d.statutPaiement === 'PAYE' || (d.montantPaye && d.montantPaye > 0)
      if (shouldComptabiliser) {
        const montantCompta = d.montantPaye && d.montantPaye > 0 ? d.montantPaye : d.montant

        // Supprimer les anciennes écritures et re-créer
        await deleteEcrituresByReference('DEPENSE', id, tx)
        await comptabiliserDepense({
          depenseId: d.id,
          date: d.date,
          montantTotal: montantCompta,
          montantPaye: d.montantPaye || 0,
          categorie: d.categorie,
          libelle: d.libelle,
          modePaiement: d.modePaiement,
          utilisateurId: session.userId,
          magasinId: d.magasinId,
          entiteId: d.entiteId,
        }, tx)
      }

      // RD2: Re-synchroniser la trésorerie (caisse ou banque)
      if (shouldComptabiliser && d.montantPaye && d.montantPaye > 0) {
        // Nettoyer les anciens mouvements de trésorerie (par motif exact basé sur l'ID)
        await tx.caisse.deleteMany({
          where: {
            entiteId: d.entiteId,
            type: 'SORTIE',
            motif: { contains: `Dépense #${id}` }
          }
        })

        // Supprimer les anciennes opérations bancaires (par libellé basé sur l'ID)
        const oldOpsBancaires = await tx.operationBancaire.findMany({
          where: {
            entiteId: d.entiteId,
            libelle: { contains: `Dépense #${id}` }
          }
        })
        for (const op of oldOpsBancaires) {
          await tx.banque.update({
            where: { id: op.banqueId },
            data: { soldeActuel: { increment: op.montant } }
          })
          await tx.operationBancaire.delete({ where: { id: op.id } })
        }

        // Créer les nouveaux mouvements de trésorerie
        if (estModeEspeces(d.modePaiement)) {
          // Espèces → caisse
          let targetMagasinId = d.magasinId
          if (!targetMagasinId) {
            const firstMag = await tx.magasin.findFirst({
              where: { entiteId: d.entiteId },
              select: { id: true }
            })
            if (firstMag) targetMagasinId = firstMag.id
          }
          if (targetMagasinId) {
            await enregistrerMouvementCaisse({
              magasinId: targetMagasinId,
              type: 'SORTIE',
              motif: `Dépense #${d.id} : ${d.libelle}${d.beneficiaire ? ' (' + d.beneficiaire + ')' : ''}`,
              montant: d.montantPaye,
              utilisateurId: session.userId,
              entiteId: d.entiteId,
              date: d.date,
            }, tx)
          }
        } else if (d.modePaiement !== 'CREDIT') {
          // Banque (virement, mobile money, cheque)
          if (d.banqueId) {
            await enregistrerOperationBancaire({
              banqueId: d.banqueId,
              entiteId: d.entiteId,
              date: d.date,
              type: 'DEPENSE',
              libelle: `Dépense #${d.id} : ${d.libelle}`,
              montant: d.montantPaye,
              utilisateurId: session.userId,
              reference: d.pieceJustificative || `EXP-${d.id}`,
              beneficiaire: d.beneficiaire || null,
              observation: d.observation
            }, tx)
          }
        }
      }

      return d
    }, { timeout: 20000 })

    // Recalculer le solde de la caisse après modification
    if (depense.magasinId) {
      await recalculerSoldeCaisse(depense.magasinId)
    }

    revalidatePath('/dashboard/depenses')
    revalidatePath('/api/depenses')

    return NextResponse.json(depense)
  } catch (e) {
    console.error('PATCH /api/depenses/[id]:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // Note: Autorisation étendue aux ADMIN pour suppression "à souhait"
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer une dépense.' }, { status: 403 })
  }

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    // RD3: Mettre à jour le solde de la caisse après suppression
    let magasinIdCaisse: number | null = null

await prisma.$transaction(async (tx) => {
      const entiteId = await getEntiteId(session)
      const d = await tx.depense.findUnique({ where: { id } })
      if (!d) throw new Error('Dépense introuvable.')

      // VERROU DE CLÔTURE (Au sein de la transaction pour Atomicité + Performance)
      await verifierCloture(d.date, session, tx)

      // Sécurité Multi-Entité
      if (session.role !== 'SUPER_ADMIN' && d.entiteId !== entiteId) {
        throw new Error('Non autorisé : Cette dépense ne vous appartient pas.')
      }

      // Stocker le magasinId pour le recalcul après transaction
      magasinIdCaisse = d.magasinId

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('DEPENSE', id, tx)

      // 2. Nettoyage Trésorerie : CAISSE (motif exact basé sur l'ID)
      await tx.caisse.deleteMany({
        where: {
          entiteId: d.entiteId,
          type: 'SORTIE',
          motif: { contains: `Dépense #${id}` }
        }
      })

      // 3. Nettoyage Trésorerie : BANQUE (libellé basé sur l'ID)
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { 
          entiteId: d.entiteId,
          libelle: { contains: `Dépense #${id}` },
          banque: { entiteId: d.entiteId }
        }
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

      // 4. Supprimer la dépense
      await tx.depense.delete({ where: { id } })

      // 5. LOG D'AUDIT
      await logSuppression(session, 'DEPENSE', id, `SUPPRESSION RADICALE : Dépense "${d.libelle}" (${d.montant} F) annulée avec régul. trésorerie`, { id, libelle: d.libelle, montant: d.montant }, getIpAddress(_request))
    }, { timeout: 30000 })

    // RD3: Recalculer le solde de la caisse après suppression
    if (magasinIdCaisse) {
      await recalculerSoldeCaisse(magasinIdCaisse)
    }

    revalidatePath('/dashboard/depenses')
    revalidatePath('/api/depenses')

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/depenses/[id]:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur lors de la suppression.'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}