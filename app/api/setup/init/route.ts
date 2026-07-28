import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { MODES_INSTALLATION } from '@/lib/enums-commerce'

function sanitizeUrl(url: string) {
  return url.replace(/\/\/.*@/, '//***:***@')
}

function autoInstallPostgres(dataDir: string) {
  try {
    const _require = eval('require')
    const pgManager = _require(path.join(process.cwd(), 'scripts', 'postgres-manager'))
    const result = pgManager.ensurePostgres(dataDir)
    return result.creds
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error('Installation automatique PostgreSQL échouée: ' + msg)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, postgres, autoInstall } = body

    if (!mode || !MODES_INSTALLATION.includes(mode)) {
      return NextResponse.json({ error: 'Mode d\'installation invalide' }, { status: 400 })
    }

    const dataDir = process.env.GESTICOM_USER_DATA || process.cwd()
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

    let pgCreds = postgres
    if (mode === 'MODE_2' && autoInstall) {
      pgCreds = autoInstallPostgres(dataDir)
    }

    if (mode === 'MODE_2') {
      if (!pgCreds || !pgCreds.host || !pgCreds.database || !pgCreds.user || !pgCreds.password) {
        return NextResponse.json({ error: 'Tous les champs PostgreSQL sont requis' }, { status: 400 })
      }
      if (pgCreds.password.length < 8) {
        return NextResponse.json({ error: 'Le mot de passe PostgreSQL doit contenir au moins 8 caractères' }, { status: 400 })
      }
    }

    const prismaCli = process.env.GESTICOM_PRISMA_PATH || path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')

    const baseDir = process.env.GESTICOM_UNPACKED_PATH || process.cwd()

    const config: Record<string, any> = { mode }
    if (mode === 'MODE_2') {
      config.postgres = {
        host: pgCreds.host,
        port: pgCreds.port || 5432,
        database: pgCreds.database,
        user: pgCreds.user,
        password: pgCreds.password,
      }
      const url = `postgresql://${encodeURIComponent(pgCreds.user)}:${encodeURIComponent(pgCreds.password)}@${pgCreds.host}:${pgCreds.port || 5432}/${pgCreds.database}`
      console.log('[setup] Test connexion PostgreSQL: ' + sanitizeUrl(url))

      const schemaPath = path.join(baseDir, 'prisma', 'schema.postgres.prisma')
      if (fs.existsSync(prismaCli) && fs.existsSync(schemaPath)) {
        const r = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--accept-data-loss', '--schema=' + schemaPath], {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 60000,
          windowsHide: true,
          env: {
            ...process.env,
            DATABASE_URL: url,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
          },
        })
        if (r.status !== 0) {
          const err = (r.stderr?.toString() || '').slice(0, 500) || 'Échec de connexion au serveur PostgreSQL'
          return NextResponse.json({ error: 'Connexion PostgreSQL échouée: ' + err }, { status: 400 })
        }
        console.log('[setup] Schema PostgreSQL créé avec succès')

        const seedScript = path.join(baseDir, 'scripts', 'seed.js')
        if (fs.existsSync(seedScript)) {
          const seed = spawnSync(process.execPath, [seedScript], {
            cwd: baseDir,
            stdio: 'pipe',
            timeout: 30000,
            windowsHide: true,
            env: {
              ...process.env,
              DATABASE_URL: url,
            },
          })
          if (seed.status === 0) console.log('[setup] Seed exécuté avec succès')
          else console.error('[setup] Seed échoué: ' + (seed.stderr?.toString() || '').slice(0, 200))
        }
      }
    }

    if (mode === 'MODE_1') {
      const dbUrl = `file:${dataDir}/gesticom.db`
      const schemaPathSqlite = path.join(baseDir, 'prisma', 'schema.prisma')
      if (fs.existsSync(prismaCli) && fs.existsSync(schemaPathSqlite)) {
        const r = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--accept-data-loss', '--schema=' + schemaPathSqlite], {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 60000,
          windowsHide: true,
          env: {
            ...process.env,
            DATABASE_URL: dbUrl,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
          },
        })
        if (r.status !== 0) {
          const err = (r.stderr?.toString() || '').slice(0, 500)
          return NextResponse.json({ error: 'Initialisation SQLite échouée: ' + err }, { status: 400 })
        }
        console.log('[setup] Schema SQLite créé avec succès')

        const seedScript = path.join(baseDir, 'scripts', 'seed.js')
        if (fs.existsSync(seedScript)) {
          const seed = spawnSync(process.execPath, [seedScript], {
            cwd: baseDir,
            stdio: 'pipe',
            timeout: 30000,
            windowsHide: true,
            env: {
              ...process.env,
              DATABASE_URL: dbUrl,
            },
          })
          if (seed.status === 0) console.log('[setup] Seed SQLite exécuté avec succès')
          else console.error('[setup] Seed SQLite échoué: ' + (seed.stderr?.toString() || '').slice(0, 200))
        }
      }
    }

    const configPath = path.join(dataDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      message: mode === 'MODE_1'
        ? 'Configuration mono-poste enregistrée. Redémarrage...'
        : 'Configuration PostgreSQL enregistrée. Redémarrage...',
    })
  } catch (e) {
    console.error('[setup] Erreur:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Erreur serveur: ' + msg }, { status: 500 })
  }
}
