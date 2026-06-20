import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const errorLogSchema = z.object({
  message: z.string().default('Erreur inconnue'),
  source: z.string().max(200).optional().default('frontend'),
  component: z.string().max(200).optional(),
  stack: z.string().optional(),
  context: z.unknown().optional(),
  userAction: z.string().max(500).optional(),
  level: z.enum(['error', 'warn', 'info']).optional().default('error'),
  url: z.string().max(500).optional(),
})

const errorLogFile = path.resolve(process.cwd(), 'logs', 'errors.ndjson')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validateApiRequest(errorLogSchema, body)
    if (!validation.success) return validation.response
    const d = validation.data
    const entry = {
      timestamp: new Date().toISOString(),
      source: d.source,
      component: d.component,
      message: d.message,
      stack: d.stack,
      context: d.context,
      userAction: d.userAction,
      level: d.level,
      url: d.url,
    }
    try {
      fs.mkdirSync(path.dirname(errorLogFile), { recursive: true })
      fs.appendFileSync(errorLogFile, JSON.stringify(entry) + '\n', 'utf-8')
    } catch {}
    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/errors/log')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
