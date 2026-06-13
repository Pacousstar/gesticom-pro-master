import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const serverStartTime = Date.now()

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000)

  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {}

  const dbPath = path.resolve(process.cwd(), 'prisma', 'gesticom.db')
  let dbSizeBytes = 0
  try {
    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size
    }
  } catch {}

  let diskFree = 0
  let diskTotal = 0
  try {
    const root = path.parse(process.cwd()).root
    diskFree = os.freemem()
    diskTotal = os.totalmem()
  } catch {}

  return NextResponse.json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: {
      seconds: uptimeSeconds,
      human: formatDuration(uptimeSeconds),
      startedAt: new Date(serverStartTime).toISOString(),
    },
    database: {
      connected: dbOk,
      sizeBytes: dbSizeBytes,
      sizeHuman: formatBytes(dbSizeBytes),
      path: dbPath,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryFree: diskFree,
      memoryTotal: diskTotal,
      hostname: os.hostname(),
    },
    app: {
      version: process.env.NEXT_PUBLIC_APP_VERSION || '',
      environment: process.env.NODE_ENV || 'development',
    },
  })
}

function formatDuration(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}j`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
