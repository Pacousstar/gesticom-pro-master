import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    
    // Vérification de la permission
    if (session.role !== 'SUPER_ADMIN' && (!session.permissions || !session.permissions.includes('rapports:view'))) {
        return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 })
    }

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')
        const clientId = searchParams.get('clientId')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const where: any = { statut: 'VALIDEE' }
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }
        if (clientId) {
            where.clientId = parseInt(clientId)
        }

        const [ventes, total] = await Promise.all([
            prisma.vente.findMany({
                where,
                include: { client: { select: { nom: true, code: true } } },
                orderBy: { date: 'desc' },
                skip,
                take: limit
            }),
            prisma.vente.count({ where })
        ])

        const data = ventes.map(v => ({
            id: v.id,
            numero: v.numero,
            date: v.date,
            client: v.client?.nom || v.clientLibre || 'Client Comptoir',
            clientCode: v.client?.code || null,
            montantTotal: v.montantTotal,
            montantPaye: v.montantPaye,
            resteAPayer: v.montantTotal - v.montantPaye,
            statutPaiement: v.statutPaiement
        }))

        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API rapports factures ventes:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
