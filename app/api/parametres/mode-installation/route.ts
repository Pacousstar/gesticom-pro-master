import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/require-role'
import { MODES_INSTALLATION, estModePostgres } from '@/lib/enums-commerce'
import { readConfigFile, writeConfigFile, upsertParametreMode } from '@/lib/mode-config'
import { autoInstallPostgres } from '@/lib/auto-install'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const config = readConfigFile()
  if (MODES_INSTALLATION.includes(config.mode)) {
    return NextResponse.json({ modeInstallation: config.mode, isCurrentPostgres: !!config.postgres })
  }

  const p = await prisma.parametre.findFirst()
  return NextResponse.json({ modeInstallation: p?.modeInstallation || 'MODE_1', isCurrentPostgres: false })
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

  const configData: Record<string, any> = { mode: modeInstallation }

  if (modeInstallation === 'MODE_2') {
    if (!postgres || !postgres.host || !postgres.database || !postgres.user || !postgres.password || postgres.password.length < 8) {
      return NextResponse.json({ error: 'Configuration PostgreSQL requise (mot de passe min 8 caracteres)' }, { status: 400 })
    }
    configData.postgres = {
      host: postgres.host,
      port: postgres.port || 5432,
      database: postgres.database,
      user: postgres.user,
      password: postgres.password,
    }
  }

  if (modeInstallation === 'MODE_3') {
    try {
      const creds = await autoInstallPostgres()
      configData.postgres = creds
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  writeConfigFile(configData)
  await upsertParametreMode(prisma, modeInstallation)

  const message = modeInstallation === 'MODE_1'
    ? 'Mode mono-poste enregistré. Redémarrez l\'application pour appliquer le changement.'
    : estModePostgres(modeInstallation)
      ? 'Mode réseau enregistré. Redémarrez l\'application pour utiliser PostgreSQL.'
      : 'Mode d\'installation mis à jour.'

  return NextResponse.json({ modeInstallation, message })
}
