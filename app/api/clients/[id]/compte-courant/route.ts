import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Client requis' }, { status: 400 })

        // 1. Récupérer les infos de base du client (soldes initiaux)
        const client = await prisma.client.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true }
        })

        if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

        // 2. Récupérer les ventes validées
        const ventes = await prisma.vente.findMany({
            where: { clientId: id, statut: 'VALIDEE' },
            select: { id: true, numero: true, date: true, montantTotal: true, observation: true }
        })

        // 3. Récupérer tous les règlements (liés à une vente ou libres)
        const reglements = await prisma.reglementVente.findMany({
            where: { clientId: id, statut: 'VALIDE' },
            select: { id: true, date: true, montant: true, modePaiement: true, observation: true, vente: { select: { numero: true } } }
        })

        // 4. Fusionner et trier chronologiquement
        const operations: any[] = []

        // Solde initial (si > 0)
        if (client.soldeInitial > 0) {
            operations.push({
                type: 'SOLDE_INITIAL',
                libelle: 'Solde initial (Dette reportée)',
                date: new Date(0), // Tout au début
                debit: client.soldeInitial,
                credit: 0
            })
        }

        // Avoir initial (si > 0)
        if (client.avoirInitial > 0) {
            operations.push({
                type: 'AVOIR_INITIAL',
                libelle: 'Avoir initial (Acompte reporté)',
                date: new Date(0), // Tout au début
                debit: 0,
                credit: client.avoirInitial
            })
        }

        ventes.forEach((v: any) => {
            operations.push({
                type: 'VENTE',
                id: v.id,
                libelle: `Vente N° ${v.numero}`,
                reference: v.numero,
                date: v.date,
                debit: v.montantTotal,
                credit: 0,
                observation: v.observation
            })
        })

        reglements.forEach((r: any) => {
            operations.push({
                type: 'REGLEMENT',
                id: r.id,
                libelle: r.vente ? `Règlement facture ${r.vente.numero}` : 'Règlement libre / Acompte',
                reference: r.vente?.numero || '-',
                date: r.date,
                debit: 0,
                credit: r.montant,
                mode: r.modePaiement,
                observation: r.observation
            })
        })

        // Tri par date
        operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        return NextResponse.json({
            client,
            operations
        })
    } catch (error) {
        console.error('Erreur API compte courant:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
