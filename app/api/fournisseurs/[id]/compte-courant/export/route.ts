import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { getEntiteId } from '@/lib/get-entite-id'
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

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
        return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Fournisseur requis' }, { status: 400 })

        const searchParams = request.nextUrl.searchParams
        const dateDebut = searchParams.get('dateDebut')
        const dateFin = searchParams.get('dateFin')

        const fournisseur = await prisma.fournisseur.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true, entiteId: true }
        })
        if (!fournisseur || fournisseur.entiteId !== entiteId) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

        const whereAchat: any = { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] } }
        const whereReglement: any = { fournisseurId: id, statut: { in: ['VALIDEE', 'VALIDE'] } }

        if (dateDebut) {
            whereAchat.date = { ...whereAchat.date, gte: new Date(dateDebut + 'T00:00:00') }
            whereReglement.date = { ...whereReglement.date, gte: new Date(dateDebut + 'T00:00:00') }
        }
        if (dateFin) {
            whereAchat.date = { ...whereAchat.date, lte: new Date(dateFin + 'T23:59:59') }
            whereReglement.date = { ...whereReglement.date, lte: new Date(dateFin + 'T23:59:59') }
        }

        const achats = await prisma.achat.findMany({
            where: whereAchat,
            orderBy: { date: 'asc' },
            select: { numero: true, date: true, montantTotal: true }
        })

        const reglements = await prisma.reglementAchat.findMany({
            where: whereReglement,
            orderBy: { date: 'asc' },
            select: { date: true, montant: true, modePaiement: true }
        })

        const rows: any[] = []
        let solde = 0

        // Report
        if (fournisseur.soldeInitial > 0) {
            solde += fournisseur.soldeInitial
            rows.push({
                Date: '',
                'N° Pièce': 'SI',
                Libellé: 'Solde Initial (Dette reportée)',
                Débit: fournisseur.soldeInitial,
                Crédit: 0,
                'Solde': solde
            })
        }

        if (fournisseur.avoirInitial > 0) {
            solde -= fournisseur.avoirInitial
            rows.push({
                Date: '',
                'N° Pièce': 'AI',
                Libellé: 'Avoir Initial (Acompte reporté)',
                Débit: 0,
                Crédit: fournisseur.avoirInitial,
                'Solde': solde
            })
        }

        // Achats
        for (const a of achats) {
            const montant = Number(a.montantTotal) || 0
            const dateAchat = new Date(a.date)
            solde += montant
            rows.push({
                Date: dateAchat.toLocaleDateString('fr-FR'),
                'N° Pièce': a.numero,
                Libellé: 'Achat',
                Débit: montant,
                Crédit: 0,
                'Solde': solde
            })
        }

        // Rglements
        for (const r of reglements) {
            const montant = Number(r.montant) || 0
            const dateReg = new Date(r.date)
            solde -= montant
            rows.push({
                Date: dateReg.toLocaleDateString('fr-FR'),
                'N° Pièce': 'RGL',
                Libellé: `Règlement ${r.modePaiement || ''}`,
                Débit: 0,
                Crédit: montant,
                'Solde': solde
            })
        }

        // Total line
        rows.push({
            Date: '',
            'N° Pièce': '',
            Libellé: 'TOTAL',
            Débit: rows.reduce((sum, r) => sum + (Number(r.Débit) || 0), 0),
            Crédit: rows.reduce((sum, r) => sum + (Number(r.Crédit) || 0), 0),
            'Solde': solde
        })

        const buf = await rowsToBuffer(rows, 'Relevé')
        const filename = `releve_compte_${fournisseur.nom.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
        return makeResponse(buf, filename)
    } catch (e) {
        await apiCatch(e, 'api/fournisseurs/[id]/compte-courant/export')
        return NextResponse.json({ error: 'Erreur génération export.' }, { status: 500 })
    }
}