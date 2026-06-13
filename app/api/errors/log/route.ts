import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const errorLogFile = path.resolve(process.cwd(), 'logs', 'errors.ndjson')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entry = {
      timestamp: new Date().toISOString(),
      source: body.source || 'frontend',
      component: body.component,
      message: body.message || 'Erreur inconnue',
      stack: body.stack,
      context: body.context,
      userAction: body.userAction,
      level: body.level || 'error',
      url: body.url,
    }
    try {
      fs.mkdirSync(path.dirname(errorLogFile), { recursive: true })
      fs.appendFileSync(errorLogFile, JSON.stringify(entry) + '\n', 'utf-8')
    } catch {}
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
