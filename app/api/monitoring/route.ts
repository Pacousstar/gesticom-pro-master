import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const serverStartTime = Date.now()

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession()
    const insufficient = requirePermission(session, 'parametres:view')
    if (insufficient) return insufficient

    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000)

    const dbPath = path.resolve(process.cwd(), 'prisma', 'gesticom.db')
    let dbSizeBytes = 0
    try {
      if (fs.existsSync(dbPath)) {
        dbSizeBytes = fs.statSync(dbPath).size
      }
    } catch { }

    const errorLogPath = path.resolve(process.cwd(), 'logs', 'errors.ndjson')
    let errorTotal = 0
    let errorToday = 0
    try {
      if (fs.existsSync(errorLogPath)) {
        const content = fs.readFileSync(errorLogPath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        errorTotal = lines.length
        const todayStr = new Date().toISOString().slice(0, 10)
        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (entry.timestamp && entry.timestamp.slice(0, 10) === todayStr) {
              errorToday++
            }
          } catch { }
        }
      }
    } catch { }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [ventesToday, achatsToday, userCount, entiteCount] = await Promise.all([
      prisma.vente.count({ where: { date: { gte: todayStart } } }),
      prisma.achat.count({ where: { date: { gte: todayStart } } }),
      prisma.utilisateur.count(),
      prisma.entite.count(),
    ])

    return NextResponse.json({
      uptime: {
        seconds: uptimeSeconds,
        human: formatDuration(uptimeSeconds),
        startedAt: new Date(serverStartTime).toISOString(),
      },
      database: {
        sizeBytes: dbSizeBytes,
        sizeHuman: formatBytes(dbSizeBytes),
        path: dbPath,
      },
      errors: {
        total: errorTotal,
        today: errorToday,
        logPath: errorLogPath,
      },
      activity: {
        ventesToday,
        achatsToday,
      },
      system: {
        users: userCount,
        entities: entiteCount,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        uptime: formatDuration(os.uptime()),
      },
      app: {
        version: process.env.NEXT_PUBLIC_APP_VERSION || '',
        environment: process.env.NODE_ENV || 'development',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur monitoring' }, { status: 500 })
  }
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
