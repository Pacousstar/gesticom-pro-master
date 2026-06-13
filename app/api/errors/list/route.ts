import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getSession } from '@/lib/auth'

const errorLogFile = path.resolve(process.cwd(), 'logs', 'errors.ndjson')

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    try {
      if (!fs.existsSync(errorLogFile)) return NextResponse.json([])
      const content = fs.readFileSync(errorLogFile, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const errors = lines.slice(-limit).map(l => JSON.parse(l))
      return NextResponse.json(errors)
    } catch {
      return NextResponse.json([])
    }
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    try {
      if (fs.existsSync(errorLogFile)) fs.unlinkSync(errorLogFile)
    } catch {}
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
