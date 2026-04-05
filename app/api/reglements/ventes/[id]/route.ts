import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // VERROU DE SÉCURITÉ : Interdiction de supprimer un encaissement (Seul SuperAdmin peut purger)
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Les règlements validés ne peuvent être supprimés que par la Direction Générale (Super Administrateur).' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const reglement = await prisma.reglementVente.findUnique({
      where: { id },
      include: { vente: true }
    })

    if (!reglement) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les écritures comptables
      await deleteEcrituresByReference('REGLEMENT_VENTE', id, tx)

      // 2. Supprimer les mouvements de caisse
      // On cherche par l'observation qui contient généralement le numéro de règlement ou de vente
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: { contains: `Règlement ${id}` } },
            { motif: { contains: reglement.vente?.numero || '---' } }
          ]
        }
      })

      // 3. Mettre à jour la vente si liée
      if (reglement.venteId) {
        const v = await tx.vente.findUnique({ where: { id: reglement.venteId } })
        if (v) {
          const nouveauPaye = Math.max(0, (v.montantPaye || 0) - reglement.montant)
          await tx.vente.update({
            where: { id: reglement.venteId },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauPaye >= v.montantTotal ? 'PAYE' : nouveauPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })
        }
      }

      // 4. Mettre à jour la banque si nécessaire
      if (['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(reglement.modePaiement)) {
        const banque = await tx.banque.findFirst({ where: { actif: true } })
        if (banque) {
          await tx.banque.update({
            where: { id: banque.id },
            data: { soldeActuel: { decrement: reglement.montant } }
          })
        }
      }

      // 5. Supprimer le règlement
      await tx.reglementVente.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/reglements/ventes/[id]:', e)
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
  try {
    const body = await request.json()
    const { montant, modePaiement, date, observation } = body

    const old = await prisma.reglementVente.findUnique({
      where: { id },
      include: { vente: true }
    })
    if (!old) return NextResponse.json({ error: 'Règlement introuvable.' }, { status: 404 })

    // VERROU COMPTABLE : Modification interdite après 24h pour les rôles standards
    const diffHeures = (new Date().getTime() - new Date(old.date).getTime()) / (1000 * 3600)
    if (diffHeures > 24 && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Verrou Comptable : Ce règlement a été validé il y a plus de 24h. Modification interdite.' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Annuler l'ancien impact
      await deleteEcrituresByReference('REGLEMENT_VENTE', id, tx)
      await tx.caisse.deleteMany({
        where: {
          OR: [
            { motif: { contains: `Règlement ${id}` } },
            { motif: { contains: old.vente?.numero || '---' } }
          ]
        }
      })

      // 2. Mettre à jour le règlement
      const updated = await tx.reglementVente.update({
        where: { id },
        data: {
          montant: montant != null ? Number(montant) : undefined,
          modePaiement: modePaiement || undefined,
          date: date ? new Date(date) : undefined,
          observation: observation || undefined
        },
        include: { vente: true }
      })

      // 3. Mettre à jour la vente si liée (Correction du montant payé)
      if (updated.venteId) {
        const v = await tx.vente.findUnique({ where: { id: updated.venteId } })
        if (v) {
          // On recalcule le montant payé total pour cette vente
          const tousReglements = await tx.reglementVente.findMany({
            where: { venteId: v.id, statut: 'VALIDE' }
          })
          const totalPaye = tousReglements.reduce((acc, r) => acc + r.montant, 0)
          
          await tx.vente.update({
            where: { id: v.id },
            data: {
              montantPaye: totalPaye,
              statutPaiement: totalPaye >= v.montantTotal ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'
            }
          })
        }
      }

      // 4. Mettre à jour la banque si nécessaire (différence)
      if (['CHEQUE', 'VIREMENT', 'MOBILE_MONEY'].includes(updated.modePaiement)) {
        const banque = await tx.banque.findFirst({ where: { actif: true } })
        if (banque) {
          const diff = (updated.montant - old.montant)
          await tx.banque.update({
            where: { id: banque.id },
            data: { soldeActuel: { increment: diff } }
          })
        }
      }

      return updated
    })

    // 5. Re-comptabiliser
    const { comptabiliserReglementVente } = await import('@/lib/comptabilisation')
    await comptabiliserReglementVente({
      venteId: result.venteId ?? 0,
      numeroVente: result.vente?.numero || 'SANS_NUMERO',
      date: result.date,
      montant: result.montant,
      modePaiement: result.modePaiement,
      utilisateurId: session.userId,
      entiteId: result.entiteId ?? undefined
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('PATCH /api/reglements/ventes/[id]:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur.' }, { status: 500 })
  }
}
