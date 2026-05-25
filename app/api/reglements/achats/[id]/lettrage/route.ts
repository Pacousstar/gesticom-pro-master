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

    const forbidden = requirePermission(session, 'achats:edit')
    if (forbidden) return forbidden
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
                where: { id: achatId },
                include: { ReglementAchatLigne: { select: { montant: true } } }
            })

            if (!achat) throw new Error('Achat introuvable')
            if (achat.statutPaiement === 'PAYE') throw new Error('Cette facture est déjà soldée')
            if (achat.fournisseurId !== reglement.fournisseurId) throw new Error('Le règlement appartient à un autre fournisseur')
            if (achat.entiteId !== entiteId) throw new Error('Accès refusé à cet achat (entité différente)')

            // 4. Calculer le reste à payer depuis les Lignes (source de vérité)
            const totalLignePaye = (achat.ReglementAchatLigne as any[] || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const realMontantPaye = totalLignePaye
            const resteAPayer = Math.max(0, (achat.montantTotal || 0) - realMontantPaye)
            if (reglement.montant - resteAPayer > 0.01) {
                throw new Error(`Paiement invalide: le règlement (${reglement.montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
            }

            // 5. Mettre à jour le règlement
            const updatedReglement = await tx.reglementAchat.update({
                where: { id },
                data: { achatId }
            })

            // 6. Créer la Ligne
            await tx.reglementAchatLigne.create({
                data: {
                    reglementId: id,
                    achatId,
                    montant: Math.min(reglement.montant, resteAPayer),
                }
            })

            // 7. Recalculer montantPaye depuis toutes les Lignes
            const allLignes = await tx.reglementAchatLigne.findMany({
                where: { achatId },
                select: { montant: true }
            })
            const nouveauMontantPaye = allLignes.reduce((s: number, l: any) => s + (l.montant || 0), 0)
            const nouveauStatutPaiement = nouveauMontantPaye >= (achat.montantTotal || 0) - 0.01 ? 'PAYE' : 'PARTIEL'

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
