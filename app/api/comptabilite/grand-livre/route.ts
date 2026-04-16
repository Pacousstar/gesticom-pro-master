import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: Request) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const annee = parseInt(searchParams.get('annee') || '', 10) || new Date().getFullYear()
        const compteId = searchParams.get('compteId')
        const magasinId = searchParams.get('magasinId')

        const debAnnee = new Date(annee, 0, 1)
        const finAnnee = new Date(annee, 11, 31, 23, 59, 59, 999)

        const entiteId = await getEntiteId(session)
        const where: any = {
            date: { gte: debAnnee, lte: finAnnee }
        }

        if (entiteId) where.entiteId = entiteId
        if (compteId && compteId !== 'all') where.compteId = parseInt(compteId)
        
        // Filtrage optionnel par magasin via les pièces
        if (magasinId && magasinId !== 'all') {
            const magId = parseInt(magasinId)
            const [ventes, achats] = await Promise.all([
                prisma.vente.findMany({ where: { magasinId: magId }, select: { numero: true } }),
                prisma.achat.findMany({ where: { magasinId: magId }, select: { numero: true } })
            ])
            const pieces = [...ventes.map(v => v.numero), ...achats.map(a => a.numero)]
            where.piece = { in: pieces }
        }

        const ecritures = await prisma.ecritureComptable.findMany({
            where,
            include: {
                compte: true,
                journal: true
            },
            orderBy: { date: 'asc' }
        })

        return NextResponse.json(ecritures)
    } catch (e) {
        console.error('Grand Livre API Error:', e)
        return NextResponse.json({ error: 'Erreur lors du chargement des écritures' }, { status: 500 })
    }
}
