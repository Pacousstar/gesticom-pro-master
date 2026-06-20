import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

const errorLogFile = path.resolve(process.cwd(), 'logs', 'errors.ndjson')

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const forbidden = requireRole(session, ROLES_ADMIN)
    if (forbidden) return forbidden

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    try {
      if (!fs.existsSync(errorLogFile)) return NextResponse.json([])
      const content = fs.readFileSync(errorLogFile, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const errors = lines.slice(-limit).map(l => JSON.parse(l))
      return NextResponse.json(errors)
    } catch (e) {
      void apiCatch(e, 'api/errors/list')
      return NextResponse.json([])
    }
  } catch (e) {
    void apiCatch(e, 'api/errors/list')
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const forbidden = requireRole(session, ROLES_ADMIN)
    if (forbidden) return forbidden
    try {
      if (fs.existsSync(errorLogFile)) fs.unlinkSync(errorLogFile)
    } catch (e) {
      void apiCatch(e, 'api/errors/list')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    void apiCatch(e, 'api/errors/list')
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
