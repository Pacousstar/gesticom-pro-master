import { NextResponse } from 'next/server'
import { repairVisibility } from '@/lib/repair'
import { getSession } from '@/lib/auth'

export async function POST() {
    const maintenanceEnabled = process.env.ENABLE_DANGEROUS_MAINTENANCE === 'true'
    if (process.env.NODE_ENV === 'production' || !maintenanceEnabled) {
        return NextResponse.json({ error: 'Route de maintenance désactivée en production.' }, { status: 403 })
    }
    const session = await getSession()
    if (!session || session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const repair = await repairVisibility()
    
    return NextResponse.json({ 
        status: 'ok', 
        time: new Date().toISOString(),
        env: process.env.NODE_ENV,
        db_configured: !!process.env.DATABASE_URL,
        repair
    })
}

export async function GET() {
    return NextResponse.json({ error: 'Méthode non autorisée. Utiliser POST.' }, { status: 405 })
}
