import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { getEntiteId } from '@/lib/get-entite-id'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // VERROU DE SÉCURITÉ : suppression réservée au SUPER_ADMIN
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Action interdite : Les règlements validés ne peuvent être supprimés que par la Direction Générale (Super Administrateur).' },
      { status: 403 }
    )
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)
    const reglement = await prisma.reglementAchat.findUnique({
      where: { id },
      include: { achat: true }
    })

    if (!reglement) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((reglement.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      // Les écritures des règlements achat sont stockées sous 'ACHAT_REGLEMENT' (cf. lib/comptabilisation.ts)
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)

      // Supprimer les mouvements de caisse associés (heuristique par motif / numéro)
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: { contains: `Règlement ${id}` } },
            { motif: { contains: reglement.achat?.numero || '---' } },
          ]
        }
      })

      // Mettre à jour l'achat si lié
      if (reglement.achatId) {
        const a = await tx.achat.findUnique({ where: { id: reglement.achatId } })
        if (a) {
          const nouveauPaye = Math.max(0, (a.montantPaye || 0) - reglement.montant)
          await tx.achat.update({
            where: { id: reglement.achatId },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauPaye >= a.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })
        }
      }

      // Mettre à jour la banque si nécessaire (sortie de fonds)
      if (['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(reglement.modePaiement)) {
        const banque = await tx.banque.findFirst({ where: { actif: true, entiteId } })
        if (banque) {
          await tx.banque.update({
            where: { id: banque.id },
            data: { soldeActuel: { increment: reglement.montant } }
          })
        }
      }

      await tx.reglementAchat.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/reglements/achats/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)
    const body = await request.json()
    const { montant, modePaiement, date, observation } = body

    const old = await prisma.reglementAchat.findUnique({
      where: { id },
      include: { achat: true }
    })
    if (!old) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })
    if ((old.entiteId || 0) !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // VERROU COMPTABLE : Modification interdite après 24h pour les rôles standards
    const diffHeures = (new Date().getTime() - new Date(old.date).getTime()) / (1000 * 3600)
    if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Verrou Comptable : Ce règlement a été validé il y a plus de 24h. Modification interdite.' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('ACHAT_REGLEMENT', id, tx)
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: { contains: `Règlement ${id}` } },
            { motif: { contains: old.achat?.numero || '---' } }
          ]
        }
      })

      const updated = await tx.reglementAchat.update({
        where: { id },
        data: {
          montant: montant != null ? Number(montant) : undefined,
          modePaiement: modePaiement || undefined,
          date: date ? new Date(date) : undefined,
          observation: observation || undefined,
        },
        include: { achat: true }
      })

      if (updated.achatId) {
        const a = await tx.achat.findUnique({ where: { id: updated.achatId } })
        if (a) {
          const tousReglements = await tx.reglementAchat.findMany({
            where: { achatId: a.id, statut: 'VALIDE' }
          })
          const totalPaye = tousReglements.reduce((acc: number, r: any) => acc + r.montant, 0)
          if (totalPaye - a.montantTotal > 0.01) {
            throw new Error(`Paiement invalide : le total des règlements (${totalPaye.toLocaleString()} F) dépasse le montant de la facture (${a.montantTotal.toLocaleString()} F).`)
          }
          await tx.achat.update({
            where: { id: a.id },
            data: {
              montantPaye: totalPaye,
              statutPaiement: totalPaye >= a.montantTotal ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })
        }
      }

      if (['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(updated.modePaiement)) {
        const banque = await tx.banque.findFirst({ where: { actif: true, entiteId } })
        if (banque) {
          const diff = (updated.montant - old.montant)
          // Paiement fournisseur = sortie -> augmenter le soldeActuel réduit l'impact, donc on décrémente de la diff
          await tx.banque.update({
            where: { id: banque.id },
            data: { soldeActuel: { decrement: diff } }
          })
        }
      }

      return updated
    })

    const { comptabiliserReglementAchat } = await import('@/lib/comptabilisation')
    await comptabiliserReglementAchat({
      reglementId: result.id,
      achatId: result.achatId ?? 0,
      numeroAchat: result.achat?.numero || 'SANS_NUMERO',
      date: result.date,
      montant: result.montant,
      modePaiement: result.modePaiement,
      utilisateurId: session.userId,
      entiteId: result.entiteId ?? undefined
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('PATCH /api/reglements/achats/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}

