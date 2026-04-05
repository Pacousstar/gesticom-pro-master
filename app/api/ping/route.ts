import { NextResponse } from 'next/server'
import { repairVisibility } from '@/lib/repair'

export async function GET() {
    const repair = await repairVisibility()
    
    return NextResponse.json({ 
        status: 'ok', 
        time: new Date().toISOString(),
        env: process.env.NODE_ENV,
        db_configured: !!process.env.DATABASE_URL,
        repair
    })
}
