import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

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

        if (id === 'null' || id === 'undefined' || Number.isNaN(Number(id))) {
            return NextResponse.json({ error: 'ID Fournisseur requis pour l\'historique' }, { status: 400 })
        }

        const fournisseurId = Number(id)
        const tier = await prisma.fournisseur.findUnique({
            where: { id: fournisseurId },
            select: { id: true, nom: true, code: true },
        })
        if (!tier) {
            return NextResponse.json([], { headers: { 'Cache-Control': 'no-store, max-age=0' } })
        }

        const entiteCur = await getEntiteId(session)

        const where: any = {
            AND: [
                {
                    OR: [
                        { fournisseurId },
                        ...(tier.nom.trim()
                            ? [{ fournisseurLibre: { equals: tier.nom.trim(), mode: 'insensitive' as const } }]
                            : []),
                        ...(tier.code?.trim()
                            ? [{ fournisseurLibre: { equals: tier.code.trim(), mode: 'insensitive' as const } }]
                            : []),
                    ],
                },
            ],
            statut: { notIn: ['ANNULE', 'ANNULEE'] },
        }

        if (entiteCur > 0) {
            where.AND.push({ entiteId: entiteCur })
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
