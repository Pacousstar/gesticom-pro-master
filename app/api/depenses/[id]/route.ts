import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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
      // Fusion avec l'heure d'origine si format YYYY-MM-DD
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
    if (body.modePaiement) {
      if (['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE', 'CREDIT'].includes(String(body.modePaiement))) {
        updateData.modePaiement = String(body.modePaiement)
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

    const depense = await prisma.depense.update({
      where: { id },
      data: updateData,
      include: {
        magasin: { select: { code: true, nom: true } },
        entite: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    revalidatePath('/dashboard/depenses')
    revalidatePath('/api/depenses')

    return NextResponse.json(depense)
  } catch (e) {
    console.error('PATCH /api/depenses/[id]:', e)
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
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer une dépense.' }, { status: 403 })
  }

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      const entiteId = await getEntiteId(session)
      const d = await tx.depense.findUnique({ where: { id } })
      if (!d) throw new Error('Dépense introuvable.')

      // Sécurité Multi-Entité
      if (session.role !== 'SUPER_ADMIN' && d.entiteId !== entiteId) {
        throw new Error('Non autorisé : Cette dépense ne vous appartient pas.')
      }

      // 1. Nettoyer compta (Grand Livre)
      await deleteEcrituresByReference('DEPENSE', id, tx)

      // 2. Nettoyage Trésorerie : CAISSE
      // On cherche les mouvements de caisse type SORTIE dont le motif correspond au format standard d'une dépense
      await tx.caisse.deleteMany({
        where: {
          entiteId: d.entiteId,
          type: 'SORTIE',
          OR: [
             { motif: { contains: `Dépense : ${d.libelle}` } },
             { motif: { contains: d.libelle } }
          ]
        }
      })

      // 3. Nettoyage Trésorerie : BANQUE
      // On cherche les opérations bancaires de cette entité dont le libellé contient le motif de la dépense
      const opsBancaires = await tx.operationBancaire.findMany({
        where: { 
          libelle: { contains: d.libelle },
          banque: { entiteId: d.entiteId }
        }
      })

      for (const op of opsBancaires) {
        // MAJ du solde de la banque concernée (on rajoute le montant car c'était une sortie)
        await tx.banque.update({
          where: { id: op.banqueId },
          data: { soldeActuel: { increment: op.montant } }
        })
        // Suppression de l'opération
        await tx.operationBancaire.delete({ where: { id: op.id } })
      }

      // 4. Supprimer la dépense
      await tx.depense.delete({ where: { id } })

      // 5. LOG D'AUDIT (Correction : entiteId correct)
      await logSuppression(session, 'DEPENSE', d.entiteId, `SUPPRESSION RADICALE : Dépense "${d.libelle}" (${d.montant} F) annulée avec régul. trésorerie`, { id, libelle: d.libelle, montant: d.montant }, getIpAddress(_request))
    }, { timeout: 20000 })

    revalidatePath('/dashboard/depenses')
    revalidatePath('/api/depenses')

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/depenses/[id]:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur lors de la suppression.'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
