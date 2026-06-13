import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'ventes:edit')
    if (forbidden) return forbidden
    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    try {
        const id = Number((await params).id)
        const body = await request.json()
        const venteId = Number(body.venteId)

        if (!id || !venteId) {
            return NextResponse.json({ error: 'ID Règlement et ID Vente requis' }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx) => {
            const reglement = await tx.reglementVente.findUnique({
                where: { id },
                include: { ReglementVenteLigne: { select: { montant: true } } }
            })

            if (!reglement) throw new Error('Règlement introuvable')
            if ((reglement.entiteId || 0) !== entiteId) throw new Error('Accès refusé (entité différente)')

            const vente = await tx.vente.findUnique({
                where: { id: venteId },
                include: { ReglementVenteLigne: { select: { montant: true } } }
            })

            if (!vente) throw new Error('Vente introuvable')
            if (vente.statutPaiement === 'PAYE') throw new Error('Cette facture est déjà soldée')
            if (vente.clientId !== reglement.clientId) throw new Error('Le règlement appartient à un autre client')
            if (vente.entiteId !== entiteId) throw new Error('Accès refusé (entité différente)')

            const dejaAlloue = (reglement.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const restantReglement = Math.max(0, reglement.montant - dejaAlloue)

            if (restantReglement <= 0.01) throw new Error('Ce règlement n\'a plus de montant disponible à lettrer')

            const realMontantPaye = (vente.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const resteAPayer = Math.max(0, (vente.montantTotal || 0) - realMontantPaye)

            if (resteAPayer <= 0.01) throw new Error('Cette facture est déjà soldée')

            const ligneExistante = await tx.reglementVenteLigne.findFirst({
                where: { reglementId: id, venteId }
            })

            if (ligneExistante) throw new Error('Ce règlement est déjà lettré à cette facture')

            const montantAlloue = Math.min(restantReglement, resteAPayer)

            await tx.reglementVenteLigne.create({
                data: { reglementId: id, venteId, montant: montantAlloue }
            })

            const allLignes = await tx.reglementVenteLigne.findMany({
                where: { venteId },
                select: { montant: true }
            })
            const nouveauMontantPaye = allLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const nouveauStatut = nouveauMontantPaye >= (vente.montantTotal || 0) - 0.01 ? 'PAYE' : 'PARTIEL'

            await tx.vente.update({
                where: { id: venteId },
                data: { montantPaye: nouveauMontantPaye, statutPaiement: nouveauStatut }
            })

            const nouveauRestant = Math.max(0, restantReglement - montantAlloue)

            return {
                restant: nouveauRestant,
                alloue: montantAlloue,
                venteId,
                statutPaiement: nouveauStatut
            }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Erreur Lettrage Vente:', error)
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
    }
}
