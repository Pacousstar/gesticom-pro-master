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
                where: { id: venteId },
                include: { ReglementVenteLigne: { select: { montant: true } } }
            })

            if (!vente) throw new Error('Vente introuvable')
            if (vente.statutPaiement === 'PAYE') throw new Error('Cette facture est déjà soldée')
            if (vente.clientId !== reglement.clientId) throw new Error('Le règlement appartient à un autre client')
            if (vente.entiteId !== entiteId) throw new Error('Accès refusé à cette vente (entité différente)')

            // 2b. Calculer le montantPaye réel depuis les Lignes (source de vérité)
            const realMontantPaye = (vente.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)

            // 3. Mettre à jour le règlement
            const updatedReglement = await tx.reglementVente.update({
                where: { id },
                data: { venteId }
            })

            // 4. Calculer le reste à payer
            const resteAPayer = Math.max(0, (vente.montantTotal || 0) - realMontantPaye)
            if (reglement.montant - resteAPayer > 0.01) {
                throw new Error(`Paiement invalide: le règlement (${reglement.montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
            }

            // 5. Créer la Ligne de règlement
            await tx.reglementVenteLigne.create({
                data: {
                    reglementId: id,
                    venteId,
                    montant: Math.min(reglement.montant, resteAPayer),
                }
            })

            // 6. Recalculer montantPaye depuis toutes les Lignes
            const allLignes = await tx.reglementVenteLigne.findMany({
                where: { venteId },
                select: { montant: true }
            })
            const nouveauMontantPaye = allLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const nouveauStatutPaiement = nouveauMontantPaye >= (vente.montantTotal || 0) - 0.01 ? 'PAYE' : 'PARTIEL'

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
