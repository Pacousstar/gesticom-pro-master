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
    const authError = requirePermission(session, 'clients:view')
    if (authError) return authError

    try {
        const id = Number((await params).id)
        if (!id) return NextResponse.json({ error: 'ID Client requis' }, { status: 400 })

        // Récupérer les ventes non payées ou partiellement payées
        const factures = await prisma.vente.findMany({
            where: { 
                clientId: id, 
                statut: { in: ['VALIDEE', 'VALIDE'] },
                statutPaiement: { in: ['CREDIT', 'PARTIEL'] } 
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
        await apiCatch(error, 'api/clients/[id]/factures-impayer')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
