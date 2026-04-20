import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    try {
        const id = Number((await params).id)
        const body = await request.json()
        const venteId = Number(body.venteId)

        if (!id || !venteId) {
            return NextResponse.json({ error: 'ID Règlement et ID Vente requis' }, { status: 400 })
        }

        const res = await prisma.$transaction(async (tx) => {
            // 1. Vérifier le règlement
            const reglement = await tx.reglementVente.findUnique({
                where: { id },
                include: { vente: true }
            })

            if (!reglement) throw new Error('Règlement introuvable')
            if (reglement.venteId) throw new Error('Ce règlement est déjà lettré à une facture')
            if ((reglement.entiteId || 0) !== entiteId) throw new Error('Accès refusé à ce règlement (entité différente)')

            // 2. Vérifier la vente
            const vente = await tx.vente.findUnique({
                where: { id: venteId }
            })

            if (!vente) throw new Error('Vente introuvable')
            if (vente.statutPaiement === 'PAYE') throw new Error('Cette facture est déjà soldée')
            if (vente.clientId !== reglement.clientId) throw new Error('Le règlement appartient à un autre client')
            if (vente.entiteId !== entiteId) throw new Error('Accès refusé à cette vente (entité différente)')

            // 3. Mettre à jour le règlement
            const updatedReglement = await tx.reglementVente.update({
                where: { id },
                data: { venteId }
            })

            // 4. Mettre à jour la vente
            const resteAPayer = Math.max(0, (vente.montantTotal || 0) - (vente.montantPaye || 0))
            if (reglement.montant - resteAPayer > 0.01) {
                throw new Error(`Paiement invalide: le règlement (${reglement.montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
            }
            const nouveauMontantPaye = Math.min(vente.montantTotal, (vente.montantPaye || 0) + reglement.montant)
            const nouveauStatutPaiement = nouveauMontantPaye >= vente.montantTotal - 0.01 ? 'PAYE' : 'PARTIEL'

            await tx.vente.update({
                where: { id: venteId },
                data: { 
                    montantPaye: nouveauMontantPaye,
                    statutPaiement: nouveauStatutPaiement
                }
            })

            return updatedReglement
        })

        return NextResponse.json(res)
    } catch (error: any) {
        console.error('Erreur Lettrage Vente:', error)
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
    }
}
