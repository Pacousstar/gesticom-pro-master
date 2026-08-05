import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { isSQLite } from '@/lib/db-provider'
import { prisma } from '@/lib/db'
import { writeConfigFile, upsertParametreMode } from '@/lib/mode-config'
import { autoInstallPostgres } from '@/lib/auto-install'
import { z } from 'zod'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const migrateSchema = z.object({
  autoInstall: z.boolean().optional().default(false),
  postgresUrl: z.string().optional(),
  password: z.string().optional(),
})

function sanitizeUrl(url: string): string {
  return url.replace(/\/\/.*@/, '//***:***@')
}

function parsePostgresUrl(url: string) {
  try {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432'),
      database: u.pathname.replace(/^\//, ''),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    }
  } catch {
    return null
  }
}

function writeConfigFileLocal(data: Record<string, any>) {
  writeConfigFile(data)
  console.log('[migrate-to-postgres] config.json mis a jour')
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, ['SUPER_ADMIN'])
  if (authError) return authError

  if (!isSQLite()) {
    return NextResponse.json(
      { error: 'La base de donnees est deja PostgreSQL.' },
      { status: 400 }
    )
  }

  try {
    const body = await req.json()
    const vres = validateApiRequest(migrateSchema, body)
    if (!vres.success) return vres.response
    const { autoInstall, postgresUrl, password } = vres.data

    let targetUrl = postgresUrl
    let targetPassword = password || ''
    if (autoInstall) {
      try {
        const creds = await autoInstallPostgres()
        targetUrl = `postgresql://${encodeURIComponent(creds.user)}:${encodeURIComponent(creds.password)}@${creds.host}:${creds.port}/${creds.database}`
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: 'Installation PostgreSQL automatique echouee: ' + msg }, { status: 500 })
      }
    } else if (!targetUrl || !targetUrl.startsWith('postgresql://')) {
      return NextResponse.json({ error: 'L\'URL PostgreSQL est requise (postgresql://...)' }, { status: 400 })
    } else if (!targetPassword || targetPassword.length < 8) {
      return NextResponse.json({ error: 'Mot de passe minimum 8 caracteres' }, { status: 400 })
    }

    const baseDir = process.env.GESTICOM_UNPACKED_PATH || process.cwd()
    const engBin = path.join(baseDir, 'node_modules', '@prisma', 'engines', 'schema-engine-windows.exe')
    const queryLib = path.join(baseDir, 'node_modules', '@prisma', 'client', 'query_engine-windows.dll.node')
    const scriptPath = path.resolve(baseDir, 'scripts', 'migrate-sqlite-to-postgres.js')
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Script de migration introuvable.' },
        { status: 500 }
      )
    }

    const urlLog = sanitizeUrl(targetUrl!)
    console.log(`[migrate-to-postgres] Lancement migration vers ${urlLog}`)

    const child = spawn(process.execPath, [scriptPath, targetUrl!], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: baseDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATABASE_URL: process.env.DATABASE_URL || '',
        DB_PASSWORD: targetPassword,
        PRISMA_SCHEMA_ENGINE_BINARY: engBin,
        PRISMA_QUERY_ENGINE_LIBRARY: queryLib,
      },
      timeout: 300000,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    const exitCode = await new Promise<number>((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve(-1) }, 300000)
      child.on('close', (code) => { clearTimeout(timer); resolve(code ?? -1) })
      child.on('error', () => { clearTimeout(timer); resolve(-1) })
    })

    if (exitCode !== 0) {
      console.error(`[migrate-to-postgres] Echec (code ${exitCode}): ${stderr}`)
      return NextResponse.json({
        error: `La migration a echoue (code ${exitCode}).`,
        details: stderr || stdout.slice(-500),
      }, { status: 500 })
    }

    console.log(`[migrate-to-postgres] Succes`)

    const pg = parsePostgresUrl(targetUrl!)
    if (pg) {
      writeConfigFileLocal({ mode: 'MODE_2', postgres: pg })
    }
    await upsertParametreMode(prisma, 'MODE_2')

    return NextResponse.json({
      success: true,
      message: 'Migration reussie ! Redemarrez GestiCom Pro pour utiliser PostgreSQL.',
      log: stdout.split('\n').filter(Boolean).slice(-10),
    })
  } catch (e) {
    await apiCatch(e, 'api/admin/migrate-to-postgres')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
