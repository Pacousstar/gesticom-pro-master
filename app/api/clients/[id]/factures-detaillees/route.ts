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

        const ventes = await prisma.vente.findMany({
            where: { clientId: id, statut: 'VALIDEE' },
            include: {
                lignes: {
                    include: {
                        produit: { select: { code: true } }
                    }
                },
                magasin: { select: { nom: true } }
            },
            orderBy: { date: 'desc' }
        })

        return NextResponse.json(ventes)
    } catch (error) {
        console.error('Erreur API factures détaillées:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
