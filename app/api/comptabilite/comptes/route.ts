import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET() {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        const authError = requirePermission(session, 'comptabilite:view')
        if (authError) return authError

        const comptes = await prisma.planCompte.findMany({
            where: { actif: true },
            orderBy: { numero: 'asc' }
        })

        return NextResponse.json(comptes)
    } catch (e) {
        await apiCatch(e, 'api/comptabilite/comptes')
        return NextResponse.json({ error: 'Erreur lors du chargement du plan de comptes' }, { status: 500 })
    }
}
