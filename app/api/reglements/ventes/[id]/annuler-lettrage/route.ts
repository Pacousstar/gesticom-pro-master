import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Action interdite : Seul l\'Administrateur peut annuler un lettrage.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const entiteId = await getEntiteId(session)

    await prisma.$transaction(async (tx) => {
      const reglement = await tx.reglementVente.findUnique({
        where: { id },
        include: { ReglementVenteLigne: true }
      })

      if (!reglement) throw new Error('Règlement introuvable')
      if ((reglement.entiteId || 0) !== entiteId) throw new Error('Accès refusé (entité différente)')
      if (!reglement.ReglementVenteLigne?.length) throw new Error('Ce règlement n\'a aucun lettrage à annuler')

      const venteIds = [...new Set(reglement.ReglementVenteLigne.map((l: any) => l.venteId))]

      // 1. Supprimer les lignes de lettrage
      await tx.reglementVenteLigne.deleteMany({ where: { reglementId: id } })

      // 2. Recalculer le statut de paiement de chaque vente concernée
      for (const venteId of venteIds) {
        const allLignes = await tx.reglementVenteLigne.findMany({
          where: { venteId },
          select: { montant: true }
        })
        const vente = await tx.vente.findUnique({
          where: { id: venteId },
          select: { montantTotal: true }
        })
        if (!vente) continue

        const totalPaye = allLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const statut = totalPaye >= (vente.montantTotal || 0) - 0.01 ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'

        await tx.vente.update({
          where: { id: venteId },
          data: { montantPaye: totalPaye, statutPaiement: statut }
        })
      }

      // 3. Remettre venteId à null (le règlement redevient libre)
      await tx.reglementVente.update({
        where: { id },
        data: { venteId: null }
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    await apiCatch(e, 'api/reglements/ventes/[id]/annuler-lettrage')
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
