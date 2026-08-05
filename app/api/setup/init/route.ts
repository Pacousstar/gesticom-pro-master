import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { MODES_INSTALLATION, estModePostgres } from '@/lib/enums-commerce'
import { prisma } from '@/lib/db'
import { getDataDir, writeConfigFile } from '@/lib/mode-config'
import { autoInstallPostgres } from '@/lib/auto-install'

function sanitizeUrl(url: string) {
  return url.replace(/\/\/.*@/, '//***:***@')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, postgres, autoInstall } = body

    if (!mode || !MODES_INSTALLATION.includes(mode)) {
      return NextResponse.json({ error: 'Mode d\'installation invalide' }, { status: 400 })
    }

    const dataDir = getDataDir()
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

    let pgCreds = postgres
    if (estModePostgres(mode) && (autoInstall || mode === 'MODE_3')) {
      pgCreds = await autoInstallPostgres()
    }

    if (estModePostgres(mode)) {
      if (!pgCreds || !pgCreds.host || !pgCreds.database || !pgCreds.user || !pgCreds.password) {
        return NextResponse.json({ error: 'Tous les champs PostgreSQL sont requis' }, { status: 400 })
      }
      if (pgCreds.password.length < 8) {
        return NextResponse.json({ error: 'Le mot de passe PostgreSQL doit contenir au moins 8 caractères' }, { status: 400 })
      }
    }

    const baseDir = process.env.GESTICOM_UNPACKED_PATH || process.cwd()

    const prismaCli = process.env.GESTICOM_PRISMA_PATH || path.join(baseDir, 'node_modules', 'prisma', 'build', 'index.js')
    const schemaEngineBin = path.join(baseDir, 'node_modules', '@prisma', 'engines', 'schema-engine-windows.exe')
    const queryEngineLib = path.join(baseDir, 'node_modules', '@prisma', 'client', 'query_engine-windows.dll.node')

    const config: Record<string, any> = { mode }
    if (estModePostgres(mode)) {
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
          cwd: baseDir,
          stdio: 'pipe',
          timeout: 120000,
          windowsHide: true,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            DATABASE_URL: url,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
            PRISMA_SCHEMA_ENGINE_BINARY: schemaEngineBin,
          },
        })
        if (r.status !== 0) {
          const err = (r.stderr?.toString() || '').slice(0, 500) || 'Échec de connexion au serveur PostgreSQL'
          return NextResponse.json({ error: 'Connexion PostgreSQL échouée: ' + err }, { status: 400 })
        }
        console.log('[setup] Schema PostgreSQL créé avec succès')

        const seedScript = path.join(baseDir, 'scripts', 'seed.js')
        if (fs.existsSync(seedScript)) {
          const pgClientPath = path.join(baseDir, 'node_modules', '@prisma', 'client-pg', 'index.js')
          const seed = spawnSync(process.execPath, [seedScript], {
            cwd: baseDir,
            stdio: 'pipe',
            timeout: 120000,
            windowsHide: true,
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: '1',
              DATABASE_URL: url,
              GESTICOM_MODE: mode,
              GESTICOM_PRISMA_CLIENT_PATH: pgClientPath,
              PRISMA_SCHEMA_ENGINE_BINARY: schemaEngineBin,
              PRISMA_QUERY_ENGINE_LIBRARY: queryEngineLib,
            },
          })
          if (seed.status === 0) console.log('[setup] Seed exécuté avec succès')
          else console.error('[setup] Seed échoué: ' + (seed.stderr?.toString() || '').slice(0, 200))
        }
        const gen = spawnSync(process.execPath, [prismaCli, 'generate', '--schema=' + schemaPath], {
          cwd: baseDir,
          stdio: 'pipe',
          timeout: 120000,
          windowsHide: true,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            DATABASE_URL: url,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
            PRISMA_SCHEMA_ENGINE_BINARY: schemaEngineBin,
          },
        })
        if (gen.status === 0) console.log('[setup] Client Prisma régénéré pour PostgreSQL')
        else console.error('[setup] Échec regénération client Prisma: ' + (gen.stderr?.toString() || '').slice(0, 200))
      }
    }

    if (mode === 'MODE_1') {
      const dbUrl = `file:${dataDir}/gesticom.db`
      const schemaPathSqlite = path.join(baseDir, 'prisma', 'schema.prisma')
      if (fs.existsSync(prismaCli) && fs.existsSync(schemaPathSqlite)) {
        const r = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--accept-data-loss', '--schema=' + schemaPathSqlite], {
          cwd: baseDir,
          stdio: 'pipe',
          timeout: 120000,
          windowsHide: true,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            DATABASE_URL: dbUrl,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
            PRISMA_SCHEMA_ENGINE_BINARY: schemaEngineBin,
          },
        })
        if (r.status !== 0) {
          const err = (r.stderr?.toString() || '').slice(0, 500)
          return NextResponse.json({ error: 'Initialisation SQLite échouée: ' + err }, { status: 400 })
        }
        console.log('[setup] Schema SQLite créé avec succès')

        try {
          const _require = eval('require')
          const seed = _require(path.join(baseDir, 'scripts', 'seed.js'))
          await seed.main(prisma, { mode })
          console.log('[setup] Seed SQLite exécuté avec succès')
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return NextResponse.json({ error: 'Erreur seed: ' + msg }, { status: 400 })
        }
      }
    }

    writeConfigFile(config)

    return NextResponse.json({
      success: true,
      message: mode === 'MODE_1'
        ? 'Configuration mono-poste enregistrée. Redémarrage...'
        : mode === 'MODE_3'
          ? 'PostgreSQL installé et configuré automatiquement. Redémarrage...'
          : 'Configuration PostgreSQL enregistrée. Redémarrage...',
    })
  } catch (e) {
    console.error('[setup] Erreur:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Erreur serveur: ' + msg }, { status: 500 })
  }
}
