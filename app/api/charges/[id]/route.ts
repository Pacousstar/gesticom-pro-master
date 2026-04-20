import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
import { verifierCloture } from '@/lib/cloture'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { logSuppression, getIpAddress } from '@/lib/audit'

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
    const updateData: {
      date?: Date
      magasinId?: number | null
      type?: string
      rubrique?: string
      beneficiaire?: string | null
      montant?: number
      observation?: string | null
    } = {}

    if (body.date) updateData.date = new Date(body.date)
    if (body.beneficiaire !== undefined) {
      updateData.beneficiaire = body.beneficiaire ? String(body.beneficiaire).trim() : null
    }
    if (body.magasinId !== undefined) {
      updateData.magasinId = body.magasinId != null ? Number(body.magasinId) : null
      if (updateData.magasinId != null) {
        const magasin = await prisma.magasin.findUnique({ where: { id: updateData.magasinId } })
        if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      }
    }
    if (body.type && ['FIXE', 'VARIABLE'].includes(String(body.type).toUpperCase())) {
      updateData.type = String(body.type).toUpperCase()
    }
    if (body.rubrique != null) updateData.rubrique = String(body.rubrique).trim()
    if (body.montant != null) updateData.montant = Math.max(0, Number(body.montant))
    if (body.observation !== undefined) updateData.observation = body.observation ? String(body.observation).trim() : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const charge = await prisma.$transaction(async (tx) => {
      // VERROU DE CLÔTURE (Au sein de la transaction pour Atomicité + Performance)
      await verifierCloture(oldCharge.date, session, tx)

      return await tx.charge.update({
        where: { id },
        data: updateData,
        include: {
          magasin: { select: { code: true, nom: true } },
          entite: { select: { code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })
    })

    return NextResponse.json(charge)
  } catch (e) {
    console.error('PATCH /api/charges/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
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

    await prisma.$transaction(async (tx) => {
      const entiteId = await getEntiteId(session)
      const charge = await tx.charge.findUnique({ where: { id } })
      if (!charge) throw new Error('Charge introuvable.')

      // VERROU DE CLÔTURE (Au sein de la transaction pour Atomicité + Performance)
      await verifierCloture(charge.date, session, tx)

      // Sécurité Multi-Entité
      if (session.role !== 'SUPER_ADMIN' && charge.entiteId !== entiteId) {
        throw new Error('Non autorisé : Cette charge ne vous appartient pas.')
      }

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('CHARGE', id, tx)

      // 2. Nettoyage Trésorerie : CAISSE
      // On cherche les sorties caisse dont le motif correspond au libellé/rubrique de la charge
      await tx.caisse.deleteMany({
        where: {
          entiteId: charge.entiteId,
          type: 'SORTIE',
          OR: [
            { motif: { contains: charge.rubrique } },
            { motif: { contains: charge.beneficiaire ?? '___X___' } },
          ]
        }
      })

      // 3. Nettoyage Trésorerie : BANQUE
      // On cherche les opérations bancaires liées à cette entité dont le libellé contient la rubrique
      const opsBancaires = await tx.operationBancaire.findMany({
        where: {
          libelle: { contains: charge.rubrique },
          banque: { entiteId: charge.entiteId }
        }
      })

      for (const op of opsBancaires) {
        // Rollback du solde bancaire (la charge était une sortie, on réincrémente)
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: { increment: op.montant } }
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

    revalidatePath('/dashboard/charges')
    revalidatePath('/api/charges')

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/charges/[id]:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur lors de la suppression.'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
