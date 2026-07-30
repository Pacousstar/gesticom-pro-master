import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function resolveDataDir(): string {
  if (process.env.GESTICOM_USER_DATA) return process.env.GESTICOM_USER_DATA
  const appData = process.env.APPDATA ? path.join(process.env.APPDATA, 'gesticom-pro') : ''
  if (appData && (fs.existsSync(appData) || !fs.existsSync(path.join(process.cwd(), 'config.json')))) return appData
  return process.cwd()
}

export async function GET() {
  try {
    const dataDir = resolveDataDir()

    // 1. config.json présent → configuré
    const configPath = path.join(dataDir, 'config.json')
    if (fs.existsSync(configPath)) {
      return NextResponse.json({ configured: true })
    }

    // 2. Pas de DB → forcément non configuré
    const dbPath = path.join(dataDir, 'gesticom.db')
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ configured: false })
    }

    // 3. DB existe mais est-elle vraiment peuplée ?
    try {
      const { prisma } = await import('@/lib/db')
      const count = await prisma.utilisateur.count()
      return NextResponse.json({ configured: count > 0 })
    } catch {
      return NextResponse.json({ configured: false })
    }
  } catch {
    return NextResponse.json({ configured: false })
  }
}
