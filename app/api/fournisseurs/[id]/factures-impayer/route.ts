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

        // Récupérer les achats non payés ou partiellement payés
        const factures = await prisma.achat.findMany({
            where: { 
                fournisseurId: id, 
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
        await apiCatch(error, 'api/fournisseurs/[id]/factures-impayer')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
