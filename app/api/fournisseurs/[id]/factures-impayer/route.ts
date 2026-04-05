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

        // Récupérer les achats non payés ou partiellement payés
        const factures = await prisma.achat.findMany({
            where: { 
                fournisseurId: id, 
                statutPaiement: { in: ['NON_PAYE', 'PARTIEL'] } 
            },
            select: { 
                id: true, 
                numero: true, 
                date: true, 
                montantTotal: true, 
                montantPaye: true 
            },
            orderBy: { date: 'asc' }
        })

        return NextResponse.json(factures)
    } catch (error) {
        console.error('Erreur API achats impayés:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
