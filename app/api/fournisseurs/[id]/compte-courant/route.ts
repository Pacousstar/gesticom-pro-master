import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'fournisseurs:view')
    if (authError) return authError

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Fournisseur requis' }, { status: 400 })

        // 1. Récupérer les infos de base du fournisseur (soldes initiaux)
        const fournisseur = await prisma.fournisseur.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true }
        })

        if (!fournisseur) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

        // Filtre date optionnel
        const searchParams = request.nextUrl.searchParams
        const dateDebut = searchParams.get('dateDebut')
        const dateFin = searchParams.get('dateFin')

        const whereAchat: any = { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] } }
        const whereReglement: any = { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] } }

        if (dateDebut && dateFin) {
            const gte = new Date(dateDebut + 'T00:00:00')
            const lte = new Date(dateFin + 'T23:59:59')
            whereAchat.date = { gte, lte }
            whereReglement.date = { gte, lte }
        }

        // R1: Récupérer les achats validés
        const achats = await prisma.achat.findMany({
            where: whereAchat,
            select: { id: true, numero: true, date: true, createdAt: true, montantTotal: true, observation: true }
        })

        // R2: Récupérer les règlements validés
        const reglements = await prisma.reglementAchat.findMany({
            where: whereReglement,
            select: { id: true, date: true, createdAt: true, montant: true, modePaiement: true, observation: true, achat: { select: { numero: true } } }
        })

        // 4. Fusionner et trier chronologiquement
        const operations: any[] = []

        if (dateDebut && dateFin) {
            // Calculer le solde réel à la date début du filtre
            const debut = new Date(dateDebut + 'T00:00:00')
            const [achatsAvant, reglementsAvant] = await Promise.all([
                prisma.achat.aggregate({
                    where: { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] }, date: { lt: debut } },
                    _sum: { montantTotal: true }
                }),
                prisma.reglementAchat.aggregate({
                    where: { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] }, date: { lt: debut } },
                    _sum: { montant: true }
                })
            ])
            const soldeAvant = (achatsAvant._sum.montantTotal || 0) + (fournisseur.soldeInitial || 0)
                - (reglementsAvant._sum.montant || 0) - (fournisseur.avoirInitial || 0)
            if (Math.abs(soldeAvant) > 0.01) {
                operations.push({
                    type: 'SOLDE_OUVERTURE',
                    libelle: soldeAvant > 0 ? 'Solde à l\'ouverture (Débiteur)' : 'Solde à l\'ouverture (Créditeur)',
                    date: debut,
                    debit: soldeAvant > 0 ? soldeAvant : 0,
                    credit: soldeAvant < 0 ? Math.abs(soldeAvant) : 0,
                    isInitial: true
                })
            }
        } else {
            if (fournisseur.soldeInitial > 0) {
                operations.push({
                    type: 'SOLDE_INITIAL',
                    libelle: 'Solde initial (Dette reportée)',
                    date: new Date(0), 
                    debit: fournisseur.soldeInitial,
                    credit: 0
                })
            }

            if (fournisseur.avoirInitial > 0) {
                operations.push({
                    type: 'AVOIR_INITIAL',
                    libelle: 'Avoir initial (Acompte reporté)',
                    date: new Date(0),
                    debit: 0,
                    credit: fournisseur.avoirInitial
                })
            }
        }

        achats.forEach(a => {
            operations.push({
                type: 'ACHAT',
                id: a.id,
                libelle: `Achat N° ${a.numero}`,
                reference: a.numero,
                date: a.date,
                createdAt: a.createdAt,
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
                createdAt: r.createdAt,
                debit: 0,
                credit: r.montant,
                mode: r.modePaiement,
                observation: r.observation
            })
        })

        // Tri par date
        operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Calcul global du solde (cohérent avec clients/soldes)
        const totalAchatsGlobal = achats.reduce((s, a) => s + (a.montantTotal || 0), 0)
        const totalReglementsGlobal = reglements.reduce((s, r) => s + (r.montant || 0), 0)
        const totalDebitGlobal = totalAchatsGlobal + (fournisseur.soldeInitial || 0)
        const totalCreditGlobal = totalReglementsGlobal + (fournisseur.avoirInitial || 0)
        const globalSolde = totalDebitGlobal - totalCreditGlobal

        return NextResponse.json({
            fournisseur,
            operations,
            totalDebitGlobal,
            totalCreditGlobal,
            globalSolde,
            soldeInitial: fournisseur.soldeInitial || 0,
            avoirInitial: fournisseur.avoirInitial || 0
        })
    } catch (error) {
        await apiCatch(error, 'api/fournisseurs/[id]/compte-courant')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
