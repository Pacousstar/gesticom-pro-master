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
        const achatId = Number(body.achatId)

        if (!id || !achatId) {
            return NextResponse.json({ error: 'ID Règlement et ID Achat requis' }, { status: 400 })
        }

        const res = await prisma.$transaction(async (tx) => {
            // 1. Vérifier le règlement
            const reglement = await tx.reglementAchat.findUnique({
                where: { id },
                include: { achat: true }
            })

            if (!reglement) throw new Error('Règlement introuvable')
            if (reglement.achatId) throw new Error('Ce règlement est déjà lettré à une facture')
            if ((reglement.entiteId || 0) !== entiteId) throw new Error('Accès refusé à ce règlement (entité différente)')

            // 2. Vérifier l'achat
            const achat = await tx.achat.findUnique({
                where: { id: achatId }
            })

            if (!achat) throw new Error('Achat introuvable')
            if (achat.statutPaiement === 'PAYE') throw new Error('Cette facture est déjà soldée')
            if (achat.fournisseurId !== reglement.fournisseurId) throw new Error('Le règlement appartient à un autre fournisseur')
            if (achat.entiteId !== entiteId) throw new Error('Accès refusé à cet achat (entité différente)')

            // 3. Mettre à jour le règlement
            const updatedReglement = await tx.reglementAchat.update({
                where: { id },
                data: { achatId }
            })

            // 4. Mettre à jour l'achat
            const resteAPayer = Math.max(0, (achat.montantTotal || 0) - (achat.montantPaye || 0))
            if (reglement.montant - resteAPayer > 0.01) {
                throw new Error(`Paiement invalide: le règlement (${reglement.montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
            }
            const nouveauMontantPaye = Math.min(achat.montantTotal, (achat.montantPaye || 0) + reglement.montant)
            const nouveauStatutPaiement = nouveauMontantPaye >= achat.montantTotal - 0.01 ? 'PAYE' : 'PARTIEL'

            await tx.achat.update({
                where: { id: achatId },
                data: { 
                    montantPaye: nouveauMontantPaye,
                    statutPaiement: nouveauStatutPaiement
                }
            })

            return updatedReglement
        })

        return NextResponse.json(res)
    } catch (error: any) {
        console.error('Erreur Lettrage Achat:', error)
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
    }
}
