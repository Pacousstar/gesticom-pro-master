const path = require('path')
const fs = require('fs')
const { execSync, spawn } = require('child_process')

const appDir = path.resolve(__dirname, '..')
const pgsqlZip = path.join(appDir, 'pgsql', 'postgresql-16.14-2-windows-x64-binaries.zip')
const pgsqlDir = path.join(appDir, 'pgsql', 'pgsql')
const pgBin = path.join(pgsqlDir, 'bin')
const pgData = 'C:/gesticom/pgdata'
const dbName = 'gesticom'
const dbUser = 'gesticom'
const pwArgIndex = process.argv.indexOf('--password')
const dbPassword = pwArgIndex !== -1 && process.argv[pwArgIndex + 1] ? process.argv[pwArgIndex + 1] : (process.env.DB_PASSWORD || 'GestiCom@2024')
const logFile = path.join(appDir, 'GestiComService.out')
const errFile = path.join(appDir, 'GestiComService.err')

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [pg-install] ' + msg + '\n') } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [pg-install] ' + msg + '\n') } catch {}
}

function run(cmd, opts = {}) {
  l(`> ${cmd}`)
  try {
    return execSync(cmd, { stdio: 'pipe', windowsHide: true, timeout: 60000, ...opts }).toString().trim()
  } catch (err) {
    l(`  ÉCHEC: ${err.stderr || err.message}`)
    return null
  }
}

async function main() {
  l('=== Installation PostgreSQL ===')

  // 1. Extraire le zip si nécessaire
  if (!fs.existsSync(pgBin)) {
    l('Extraction de PostgreSQL...')
    fs.mkdirSync(path.join(appDir, 'pgsql'), { recursive: true })
    if (!fs.existsSync(pgsqlZip)) {
      e('Zip PostgreSQL introuvable: ' + pgsqlZip)
      process.exit(1)
    }
    run(`powershell -Command "Expand-Archive -Path '${pgsqlZip}' -DestinationPath '${path.join(appDir, 'pgsql')}' -Force"`)
    if (!fs.existsSync(pgBin)) {
      e('Échec extraction zip')
      process.exit(1)
    }
    l('Extraction terminée')
  } else {
    l('PostgreSQL déjà extrait')
  }

  // 2. Initialiser le data directory
  if (!fs.existsSync(pgData)) {
    l('Initialisation du data directory...')
    fs.mkdirSync(pgData, { recursive: true })
    const out = run(`"${path.join(pgBin, 'initdb.exe')}" -D "${pgData}" --username=postgres --auth=trust --encoding=UTF8`)
    if (out === null) {
      e('Échec initdb')
      process.exit(1)
    }
    l('Data directory initialisé')
  } else {
    l('Data directory déjà existant')
  }

  // 3. Démarrer le service PostgreSQL
  l('Démarrage de PostgreSQL...')
  const pgPort = process.env.PG_PORT || '5432'
  
  // Arrêter une éventuelle instance précédente
  run(`"${path.join(pgBin, 'pg_ctl.exe')}" stop -D "${pgData}" -m fast`, { timeout: 10000 })
  
  const startOut = run(`"${path.join(pgBin, 'pg_ctl.exe')}" start -D "${pgData}" -l "${pgData}/pg.log" -o "-p ${pgPort} -k ${pgData}"`, { timeout: 15000 })
  if (startOut === null) {
    e('Échec démarrage PostgreSQL')
    process.exit(1)
  }

  // Attendre que PostgreSQL soit prêt
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      const check = execSync(`"${path.join(pgBin, 'pg_isready.exe')}" -p ${pgPort}`, { stdio: 'pipe', windowsHide: true, timeout: 3000 }).toString().trim()
      if (check.includes('accepting connections')) { ready = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  if (!ready) {
    e('PostgreSQL pas prêt après 30s')
    process.exit(1)
  }
  l('PostgreSQL démarré')

  // 4. Créer l'utilisateur et la base
  const psql = `"${path.join(pgBin, 'psql.exe')}" -p ${pgPort} -U postgres -d postgres -c`
  
  l('Création de l\'utilisateur...')
  run(`${psql} "CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';"`)
  
  l('Création de la base...')
  run(`${psql} "CREATE DATABASE ${dbName} OWNER ${dbUser};"`)
  
  l('Grant privileges...')
  run(`${psql} "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};"`)

  // 5. Auto-migration SQLite → PostgreSQL (upgrade)
  const sqliteDbPath = 'C:/gesticom/gesticom.db'
  const sqliteExists = fs.existsSync(sqliteDbPath)
  const migrateScript = path.join(appDir, 'scripts', 'migrate-sqlite-to-postgres.js')
  const pgUrl = `postgresql://${dbUser}:${dbPassword}@localhost:${pgPort}/${dbName}`
  let migrationRan = false

  if (sqliteExists && fs.existsSync(migrateScript)) {
    l('Base SQLite detectee → migration vers PostgreSQL...')
    // Lire la DATABASE_URL actuelle du .env
    const envPath = path.join(appDir, '.env')
    let sqliteUrl = `file:${sqliteDbPath.replace(/\\/g, '/')}`
    if (fs.existsSync(envPath)) {
      const curEnv = fs.readFileSync(envPath, 'utf-8')
      const m = curEnv.match(/^DATABASE_URL=(.+)$/m)
      if (m) sqliteUrl = m[1].replace(/^["']|["']$/g, '')
    }
    // Forcer DATABASE_URL vers SQLite pour que le script lise depuis SQLite
    process.env.DATABASE_URL = sqliteUrl
    const result = run(`"${path.join(appDir, 'node.exe')}" "${migrateScript}" "${pgUrl}"`, { timeout: 300000 })
    if (result !== null) {
      l('Migration SQLite→PostgreSQL reussie')
      migrationRan = true
    } else {
      e('Migration SQLite→PostgreSQL echouee, poursuite sans migration')
    }
  }

  // 6. Générer le .env avec la bonne URL (sauf si la migration l'a déjà fait)
  if (!migrationRan) {
    const envPath = path.join(appDir, '.env')
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }
    
    // Remplacer ou ajouter DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${pgUrl}"`)
    } else {
      envContent += `\nDATABASE_URL="${pgUrl}"\n`
    }
    
    // Ajouter HOST pour le multi-postes
    if (!envContent.includes('HOST=')) {
      envContent += '\nHOST="0.0.0.0"\n'
    }
    if (!envContent.includes('PGPORT=')) {
      envContent += `\nPGPORT=${pgPort}\n`
    }
    
    fs.writeFileSync(envPath, envContent, 'utf-8')
    l(`.env mis à jour avec DATABASE_URL=${pgUrl}`)
  }

  // 7. Installer le service Windows PostgreSQL
  const nssm = path.join(appDir, 'nssm.exe')
  if (fs.existsSync(nssm)) {
    l('Installation du service Windows PostgreSQL...')
    // Supprimer l'ancien service
    run(`"${nssm}" stop PostgreSQL`, { timeout: 5000 })
    run(`"${nssm}" remove PostgreSQL confirm`, { timeout: 5000 })
    
    // Créer le nouveau service
    const pgExe = path.join(pgBin, 'pg_ctl.exe')
    const cmds = [
      `"${nssm}" install PostgreSQL "${pgExe}"`,
      `"${nssm}" set PostgreSQL AppParameters "runservice -D \\"${pgData}\\""`,
      `"${nssm}" set PostgreSQL AppDirectory "${pgsqlDir}"`,
      `"${nssm}" set PostgreSQL AppStdout "${appDir}\\logs\\pg-out.log"`,
      `"${nssm}" set PostgreSQL AppStderr "${appDir}\\logs\\pg-err.log"`,
      `"${nssm}" set PostgreSQL AppRotateBytes 10485760`,
      `"${nssm}" set PostgreSQL ObjectName "LocalSystem"`,
      `"${nssm}" set PostgreSQL Start SERVICE_AUTO_START`,
      `"${nssm}" set PostgreSQL DisplayName "GestiCom PostgreSQL"`,
      `"${nssm}" set PostgreSQL Description "Base de donnees PostgreSQL pour GestiCom Pro"`,
    ]
    for (const c of cmds) {
      const out = run(c, { timeout: 10000 })
      if (out === null) l('  Attention: ' + c)
    }
    l('Service PostgreSQL installé')
  }

  l('=== Installation PostgreSQL terminée ===')
}

main().catch(err => {
  e('Erreur fatale: ' + (err.message || err))
  process.exit(1)
})
