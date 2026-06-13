import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'clients:view')
    if (authError) return authError

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
        return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Client requis' }, { status: 400 })

        const client = await prisma.client.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true, entiteId: true }
        })
        if (!client || client.entiteId !== entiteId) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

        const ventes = await prisma.vente.findMany({
            where: { clientId: id, statut: 'VALIDEE' },
            take: 10000,
            orderBy: { date: 'asc' },
            select: { numero: true, date: true, montantTotal: true }
        })

        const reglements = await prisma.reglementVente.findMany({
            where: { clientId: id },
            take: 10000,
            orderBy: { date: 'asc' },
            select: { date: true, montant: true, modePaiement: true }
        })

        const rows: any[] = []
        let solde = 0

        // Report
        if (client.soldeInitial > 0) {
            solde += client.soldeInitial
            rows.push({ Date: 'REPORT', Libellé: 'SOLDE INITIAL (DETTE)', Débit: client.soldeInitial, Crédit: 0, Solde: solde })
        }
        if (client.avoirInitial > 0) {
            solde -= client.avoirInitial
            rows.push({ Date: 'REPORT', Libellé: 'AVOIR INITIAL (ACOMPTE)', Débit: 0, Crédit: client.avoirInitial, Solde: solde })
        }

        // Fusionner Ventes et Règlements
        const all = [
            ...ventes.map(v => ({ date: v.date, libelle: `Vente ${v.numero}`, debit: v.montantTotal, credit: 0 })),
            ...reglements.map(r => ({ date: r.date, libelle: `Règlement (${r.modePaiement})`, debit: 0, credit: r.montant }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        all.forEach(op => {
            solde += (op.debit - op.credit)
            rows.push({
                Date: new Date(op.date).toLocaleDateString('fr-FR'),
                Libellé: op.libelle,
                Débit: op.debit,
                Crédit: op.credit,
                Solde: solde
            })
        })

        if (rows.length > 0) {
          const totalDebit = rows.reduce((s, r) => s + (Number(r.Débit) || 0), 0)
          const totalCredit = rows.reduce((s, r) => s + (Number(r.Crédit) || 0), 0)
          rows.push({ Date: '', Libellé: 'TOTAL', Débit: totalDebit, Crédit: totalCredit, Solde: solde })
        }

        const buf = await rowsToBuffer(rows, 'Compte Courant')
        const filename = `Compte_Courant_${client.nom.replace(/\s+/g, '_')}.xlsx`
        return makeResponse(buf, filename)
    } catch (error) {
        console.error('Export Excel Erreur:', error)
        return NextResponse.json({ error: 'Erreur lors de l\'export' }, { status: 500 })
    }
}
