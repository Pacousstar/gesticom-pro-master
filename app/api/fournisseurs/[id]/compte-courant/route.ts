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
        if (!id) return NextResponse.json({ error: 'ID Fournisseur requis' }, { status: 400 })

        // 1. Récupérer les infos de base du fournisseur (soldes initiaux)
        const fournisseur = await prisma.fournisseur.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true }
        })

        if (!fournisseur) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

        // 2. Récupérer les achats
        const achats = await prisma.achat.findMany({
            where: { fournisseurId: id },
            select: { id: true, numero: true, date: true, montantTotal: true, observation: true }
        })

        // 3. Récupérer tous les règlements
        const reglements = await prisma.reglementAchat.findMany({
            where: { fournisseurId: id },
            select: { id: true, date: true, montant: true, modePaiement: true, observation: true, achat: { select: { numero: true } } }
        })

        // 4. Fusionner et trier chronologiquement
        const operations: any[] = []

        // Solde initial (Dette reportée envers le fournisseur)
        if (fournisseur.soldeInitial > 0) {
            operations.push({
                type: 'SOLDE_INITIAL',
                libelle: 'Solde initial (Dette reportée)',
                date: new Date(0), 
                debit: fournisseur.soldeInitial,
                credit: 0
            })
        }

        // Avoir initial (Acompte déjà versé)
        if (fournisseur.avoirInitial > 0) {
            operations.push({
                type: 'AVOIR_INITIAL',
                libelle: 'Avoir initial (Acompte reporté)',
                date: new Date(0),
                debit: 0,
                credit: fournisseur.avoirInitial
            })
        }

        achats.forEach(a => {
            operations.push({
                type: 'ACHAT',
                id: a.id,
                libelle: `Achat N° ${a.numero}`,
                reference: a.numero,
                date: a.date,
                debit: a.montantTotal,
                credit: 0,
                observation: a.observation
            })
        })

        reglements.forEach(r => {
            operations.push({
                type: 'REGLEMENT',
                id: r.id,
                libelle: r.achat ? `Règlement facture ${r.achat.numero}` : 'Règlement libre / Avoir',
                reference: r.achat?.numero || '-',
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
            fournisseur,
            operations
        })
    } catch (error) {
        console.error('Erreur API compte courant fournisseur:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
