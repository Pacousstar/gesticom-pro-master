import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx-prototype-pollution-fixed'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Client requis' }, { status: 400 })

        const client = await prisma.client.findUnique({
            where: { id },
            select: { nom: true, code: true, soldeInitial: true, avoirInitial: true }
        })
        if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

        const ventes = await prisma.vente.findMany({
            where: { clientId: id, statut: 'VALIDEE' },
            orderBy: { date: 'asc' },
            select: { numero: true, date: true, montantTotal: true }
        })

        const reglements = await prisma.reglementVente.findMany({
            where: { clientId: id },
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

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Compte Courant')
        
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buf, {
            headers: {
                'Content-Disposition': `attachment; filename="Compte_Courant_${client.nom.replace(/\s+/g, '_')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        })
    } catch (error) {
        console.error('Export Excel Erreur:', error)
        return NextResponse.json({ error: 'Erreur lors de l\'export' }, { status: 500 })
    }
}
