import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/require-role'
import { MODES_INSTALLATION } from '@/lib/enums-commerce'
import fs from 'fs'
import path from 'path'

function writeConfigFile(data: Record<string, any>) {
  try {
    const dataDir = process.env.GESTICOM_USER_DATA
      || (process.env.APPDATA ? path.join(process.env.APPDATA, 'gesticom-pro') : '')
      || process.cwd()
    const configPath = path.join(dataDir, 'config.json')
    let config: Record<string, any> = { mode: 'MODE_1' }
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch (_) {}
    }
    Object.assign(config, data)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    console.error('[mode-installation] Erreur ecriture config.json:', e)
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const p = await prisma.parametre.findFirst()
  return NextResponse.json({ modeInstallation: p?.modeInstallation || 'MODE_1' })
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (forbidden) return forbidden

  const body = await request.json()
  const { modeInstallation, postgres } = body
  if (!modeInstallation || !MODES_INSTALLATION.includes(modeInstallation)) {
    return NextResponse.json({ error: 'Mode d\'installation invalide' }, { status: 400 })
  }

  const p = await prisma.parametre.findFirst()
  if (!p) {
    await prisma.parametre.create({ data: { modeInstallation } })
  } else {
    await prisma.parametre.update({ where: { id: p.id }, data: { modeInstallation } })
  }

  if (modeInstallation === 'MODE_2') {
    if (!postgres || !postgres.password || postgres.password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe PostgreSQL requis (min 8 caracteres)' }, { status: 400 })
    }
  }
  const configData: Record<string, any> = { mode: modeInstallation }
  if (modeInstallation === 'MODE_2' && postgres) {
    configData.postgres = {
      host: postgres.host || 'localhost',
      port: postgres.port || 5432,
      database: postgres.database || 'gesticom',
      user: postgres.user || 'gesticom',
      password: postgres.password,
    }
  }
  writeConfigFile(configData)

  return NextResponse.json({ modeInstallation })
}
