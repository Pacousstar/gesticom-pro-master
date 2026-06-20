import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { logSuppression, getIpAddress } from '@/lib/audit'
import { comptabiliserCharge } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { chargeSchema } from '@/lib/validations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'charges:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      entite: { select: { id: true, code: true, nom: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  if (!charge) {
    return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })
  }

  // Sécurité Multi-Entité
  const entiteId = await getEntiteId(session)
  if (session.role !== 'SUPER_ADMIN' && charge.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  return NextResponse.json(charge)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'charges:edit')
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const oldCharge = await prisma.charge.findUnique({ where: { id } })
    if (!oldCharge) return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })

    // Sécurité Multi-Entité
    if (session.role !== 'SUPER_ADMIN' && oldCharge.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateApiRequest(chargeSchema.partial(), body)
    if (!validation.success) return validation.response
    const data = validation.data

    const updateData: Record<string, unknown> = {}

    if (data.date) updateData.date = new Date(data.date)
    if (data.beneficiaire !== undefined) updateData.beneficiaire = data.beneficiaire ?? null
    if (data.magasinId !== undefined) {
      updateData.magasinId = data.magasinId
      const magasinId = data.magasinId as number | undefined
      if (magasinId != null) {
        const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
        if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      }
    }
    if (data.type) updateData.type = data.type
    if (data.rubrique != null) updateData.rubrique = data.rubrique
    if (data.montant != null) updateData.montant = data.montant
    if (data.observation !== undefined) updateData.observation = data.observation ?? null
    if (data.modePaiement) updateData.modePaiement = data.modePaiement
    if (data.banqueId !== undefined) updateData.banqueId = data.banqueId ?? null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const charge = await prisma.$transaction(async (tx) => {
      // VERROU DE CLÔTURE
      await verifierCloture(oldCharge.date, session, tx)

      const c = await tx.charge.update({
        where: { id },
        data: updateData,
        include: {
          magasin: { select: { code: true, nom: true } },
          entite: { select: { code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })

      // RC1: Re-comptabiliser après modification
      await deleteEcrituresByReference('CHARGE', id, tx)
      await comptabiliserCharge({
        chargeId: c.id,
        date: c.date,
        montant: c.montant,
        rubrique: c.rubrique,
        libelle: c.observation,
        utilisateurId: session.userId,
        entiteId: c.entiteId,
        magasinId: c.magasinId,
        modePaiement: c.modePaiement,
      }, tx)

// RC2: Re-synchroniser la trésorerie (caisse ou banque)
      // Nettoyer les anciens mouvements par motif exact basé sur l'ID
      await tx.caisse.deleteMany({
        where: {
          entiteId: c.entiteId,
          type: 'SORTIE',
          motif: { contains: `#${id}` }
        }
      })

      const oldOpsBancaires = await tx.operationBancaire.findMany({
        where: {
          entiteId: c.entiteId,
          reference: { contains: `CHG-${id}` },
          banque: { entiteId: c.entiteId }
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
      if (estModeEspeces(c.modePaiement)) {
        let targetMagasinId = c.magasinId
        if (!targetMagasinId) {
          const firstMag = await tx.magasin.findFirst({
            where: { entiteId: c.entiteId },
            select: { id: true }
          })
          if (firstMag) targetMagasinId = firstMag.id
        }
        if (targetMagasinId) {
          await enregistrerMouvementCaisse({
            magasinId: targetMagasinId,
            type: 'SORTIE',
            motif: `Charge #${c.id} : ${c.rubrique}${c.observation ? ' (' + c.observation + ')' : ''}`,
            montant: c.montant,
            utilisateurId: session.userId,
            entiteId: c.entiteId,
            date: c.date,
          }, tx)
        }
      } else if (c.banqueId) {
        await enregistrerOperationBancaire({
          banqueId: c.banqueId,
          entiteId: c.entiteId,
          date: c.date,
          type: 'CHARGE',
          libelle: `Charge : ${c.rubrique}`,
          montant: c.montant,
          utilisateurId: session.userId,
          reference: `CHG-${c.id}`,
          beneficiaire: c.beneficiaire || null,
          observation: c.observation
        }, tx)
      }

      return c
    }, { timeout: 20000 })

    // Recalculer le solde de la caisse après modification
    const magasinsAReCalculer = new Set<number>()
    if (oldCharge.magasinId) magasinsAReCalculer.add(oldCharge.magasinId)
    if (charge.magasinId) magasinsAReCalculer.add(charge.magasinId)
    for (const mId of magasinsAReCalculer) {
      await recalculerSoldeCaisse(mId)
    }

    return NextResponse.json(charge)
  } catch (e) {
    await apiCatch(e, 'api/charges/[id]')
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
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer une charge.' }, { status: 403 })
  }

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    // RC3: Stocker le magasinId pour le recalcul après transaction
    let magasinIdCaisse: number | null = null

    await prisma.$transaction(async (tx) => {
      const entiteId = await getEntiteId(session)
      const charge = await tx.charge.findUnique({ where: { id } })
      if (!charge) throw new Error('Charge introuvable.')

      // Stocker pour le recalcul
      magasinIdCaisse = charge.magasinId

      // VERROU DE CLÔTURE
      await verifierCloture(charge.date, session, tx)

      // Sécurité Multi-Entité
      if (session.role !== 'SUPER_ADMIN' && charge.entiteId !== entiteId) {
        throw new Error('Non autorisé : Cette charge ne vous appartient pas.')
      }

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('CHARGE', id, tx)

      // 2. Nettoyage Trésorerie : CAISSE (motif exact basé sur l'ID)
      await tx.caisse.deleteMany({
        where: {
          entiteId: charge.entiteId,
          type: 'SORTIE',
          motif: { contains: `#${id}` }
        }
      })

      // 3. Nettoyage Trésorerie : BANQUE (libellé exact basé sur l'ID)
      const opsBancaires = await tx.operationBancaire.findMany({
        where: {
          reference: `CHG-${id}`,
          banque: { entiteId: charge.entiteId }
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

      // 4. Supprimer la charge
      await tx.charge.delete({ where: { id } })

      // 5. LOG D'AUDIT
      await logSuppression(
        session,
        'CHARGE',
        id,
        `SUPPRESSION : Charge "${charge.rubrique}" (${charge.montant} F) annulée avec régul. trésorerie`,
        { id, rubrique: charge.rubrique, montant: charge.montant, type: charge.type },
        getIpAddress(_request)
      )
    }, { timeout: 20000 })

    // RC3: Recalculer le solde de la caisse après suppression
    if (magasinIdCaisse) {
      await recalculerSoldeCaisse(magasinIdCaisse)
    }

            return NextResponse.json({ success: true })
  } catch (e) {
    await apiCatch(e, 'api/charges/[id]')
    const errorMsg = e instanceof Error ? e.message : 'Erreur lors de la suppression.'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}