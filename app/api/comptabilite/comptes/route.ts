import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const comptes = await prisma.planCompte.findMany({
            where: { actif: true },
            orderBy: { numero: 'asc' }
        })

        return NextResponse.json(comptes)
    } catch (e) {
        console.error('Plan Compte API Error:', e)
        return NextResponse.json({ error: 'Erreur lors du chargement du plan de comptes' }, { status: 500 })
    }
}
