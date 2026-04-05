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
        const id = (await params).id
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        const where: any = {}
        if (id !== 'null' && id !== 'undefined') {
            where.fournisseurId = Number(id)
        } else {
            // Pour les fournisseurs libres, on pourrait filtrer par nom, 
            // mais l'ID est plus robuste pour les fiches créées.
            return NextResponse.json({ error: 'ID Fournisseur requis pour l\'historique' }, { status: 400 })
        }

        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const achats = await prisma.achat.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                magasin: { select: { nom: true } },
                lignes: {
                    include: {
                        produit: {
                            select: {
                                designation: true,
                                code: true
                            }
                        }
                    }
                }
            }
        })

        return NextResponse.json(achats, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API historique fournisseur:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
