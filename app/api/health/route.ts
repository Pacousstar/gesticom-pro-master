import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}
  let healthy = true

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }

  const uptime = process.uptime()

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      version: '3.42.5',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      checks,
    },
    { status: healthy ? 200 : 503 },
  )
}
