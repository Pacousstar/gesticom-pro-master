import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { isSQLite } from '@/lib/db-provider'
import { z } from 'zod'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const migrateSchema = z.object({
  postgresUrl: z.string().startsWith('postgresql://', 'L\'URL doit commencer par postgresql://'),
  password: z.string().min(8, 'Mot de passe minimum 8 caracteres'),
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
    console.log('[migrate-to-postgres] config.json mis a jour')
  } catch (e) {
    console.error('[migrate-to-postgres] Erreur ecriture config.json:', e)
  }
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
    const { postgresUrl, password } = vres.data

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

    const urlLog = sanitizeUrl(postgresUrl)
    console.log(`[migrate-to-postgres] Lancement migration vers ${urlLog}`)

    const child = spawn(process.execPath, [scriptPath, postgresUrl], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: baseDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATABASE_URL: process.env.DATABASE_URL || '',
        DB_PASSWORD: password,
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

    const pg = parsePostgresUrl(postgresUrl)
    if (pg) {
      writeConfigFile({ mode: 'MODE_2', postgres: pg })
    }

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
