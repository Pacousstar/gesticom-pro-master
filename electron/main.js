const { app, BrowserWindow, ipcMain } = require('electron')
const { spawnSync } = require('child_process')
const path = require('path')
const http = require('http')
const fs = require('fs')
const crypto = require('crypto')

const PORT = 3000
const isDev = !app.isPackaged

app.commandLine.appendSwitch('enable-usermedia-screen-capture')
app.commandLine.appendSwitch('allow-file-access-from-files')

function log(msg) {
  try {
    const dataDir = app.getPath('userData')
    const logPath = path.join(dataDir, 'startup.log')
    fs.appendFileSync(logPath, new Date().toISOString() + ' ' + msg + '\n')
  } catch (_) {}
}

const pgManager = (() => {
  try { return require(path.join(__dirname, '..', 'scripts', 'postgres-manager')) }
  catch { return null }
})()

const dbLegacy = (() => {
  try { return require(path.join(__dirname, '..', 'scripts', 'db-legacy')) }
  catch { return null }
})()

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    let k = t.substring(0, eq).trim()
    let v = t.substring(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

function loadConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (e) {
    log('config.json invalide: ' + e.message)
  }
  return null
}

function findPrismaCli(basePath) {
  const candidates = [
    path.join(basePath, 'node_modules', 'prisma', 'build', 'index.js'),
  ]
  if (app.isPackaged && process.resourcesPath) {
    candidates.unshift(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'prisma', 'build', 'index.js')
    )
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function ensureEnv() {
  const dataDir = app.getPath('userData')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const envPath = path.join(dataDir, '.env')
  if (!fs.existsSync(envPath)) {
    const content = [
      `SESSION_SECRET="${crypto.randomBytes(32).toString('hex')}"`,
      `PORT=${PORT}`,
    ].join('\n')
    fs.writeFileSync(envPath, content, 'utf-8')
  }
  loadEnvFile(envPath)

  const basePath = path.join(__dirname, '..')
  process.env.GESTICOM_USER_DATA = dataDir
  process.env.GESTICOM_BASE_PATH = basePath
  if (app.isPackaged && process.resourcesPath) {
    process.env.GESTICOM_UNPACKED_PATH = path.join(process.resourcesPath, 'app.asar.unpacked')
  } else {
    process.env.GESTICOM_UNPACKED_PATH = basePath
  }
  const prismaCliPath = findPrismaCli(basePath)
  if (prismaCliPath) process.env.GESTICOM_PRISMA_PATH = prismaCliPath

  if (dbLegacy) {
    const legacyResult = dbLegacy.copyLegacyToNew(dataDir)
    if (legacyResult.copied) log('Base legacy copiee: ' + legacyResult.path + ' -> ' + path.join(dataDir, 'gesticom.db'))
    if (legacyResult.found) log('Base legacy utilisee: ' + legacyResult.path)
  }

  const config = loadConfig()
  if (!config) {
    log('aucune configuration - mode setup')
    process.env.DATABASE_URL = `file:${dataDir}/gesticom.db`
    return
  }

  if (config.mode === 'MODE_2') {
    const pg = config.postgres
    if (pg?.password) {
      const url = `postgresql://${encodeURIComponent(pg.user)}:${encodeURIComponent(pg.password)}@${pg.host}:${pg.port}/${pg.database}`
      process.env.DATABASE_URL = url
      log('mode postgresql: ' + url.replace(/\/\/.*@/, '//***:***@'))
      if (pgManager) {
        try {
          pgManager.ensurePostgres(dataDir)
          log('PostgreSQL verifie')
        } catch (e) {
          log('pgManager.ensurePostgres: ' + e.message + ' (connexion directe conservee)')
        }
      }
    } else {
      log('mode postgresql demande mais credentials manquants, fallback sqlite')
      process.env.DATABASE_URL = `file:${dataDir}/gesticom.db`
    }
  } else {
    process.env.DATABASE_URL = `file:${dataDir}/gesticom.db`
    log('mode sqlite')
  }

  if (!process.env.PORT) process.env.PORT = String(PORT)
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex')
  process.env.NODE_ENV = 'production'
}

function runDbPush(basePath) {
  const config = loadConfig()
  if (!config) { log('skip db push : pas de configuration'); return }

  const prismaCli = findPrismaCli(basePath)
  if (!prismaCli) { log('Prisma CLI introuvable'); return }
  const rootDir = process.env.GESTICOM_UNPACKED_PATH || basePath
  const schemaName = config.mode === 'MODE_2' ? 'schema.postgres.prisma' : 'schema.prisma'
  const schemaPath = path.join(rootDir, 'prisma', schemaName)
  if (!fs.existsSync(schemaPath)) { log('Schema introuvable: ' + schemaPath); return }

  try {
      const r = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--accept-data-loss', '--schema=' + schemaPath], {
      cwd: rootDir, stdio: 'pipe', timeout: 120000, windowsHide: true,
    })
    if (r.status === 0) log('db push reussi (' + schemaName + ')')
    else log('db push echoue code ' + r.status + ': ' + (r.stderr?.toString() || '').slice(0, 200))
  } catch (e) { log('db push exception: ' + e.message) }

  const seedScript = path.join(rootDir, 'scripts', 'seed.js')
  if (fs.existsSync(seedScript)) {
    try {
      const r = spawnSync(process.execPath, [seedScript], {
        cwd: rootDir, stdio: 'pipe', timeout: 120000, windowsHide: true,
      })
      if (r.status === 0) log('seed reussi')
      else log('seed echoue code ' + r.status + ': ' + (r.stderr?.toString() || '').slice(0, 200))
    } catch (e) { log('seed exception: ' + e.message) }
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      waitForServer(resolve)
      return
    }

    const basePath = path.join(__dirname, '..')
    log('basePath: ' + basePath)
    ensureEnv()
    log('env ok')
    runDbPush(basePath)
    log('db ok, demarrage serveur Next.js...')

    const next = require('next')
    const { parse } = require('url')

    const nextApp = next({ dev: false, dir: basePath })
    const handle = nextApp.getRequestHandler()

    nextApp.prepare().then(() => {
      log('Next.js pret, creation serveur HTTP...')
      http.createServer((req, res) => {
        handle(req, res, parse(req.url, true))
      }).listen(PORT, () => {
        log('Serveur HTTP ecoute sur port ' + PORT)
        resolve()
      })
    }).catch((err) => {
      log('Erreur nextApp.prepare(): ' + (err.message || err))
      reject(err)
    })
  })
}

function waitForServer(resolve, retries = 0) {
  if (retries > 60) return resolve()
  http.get('http://127.0.0.1:' + PORT, (res) => {
    resolve()
  }).on('error', () => {
    setTimeout(() => waitForServer(resolve, retries + 1), 1000)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'public', 'gesticom.ico'),
    title: 'GestiCom Pro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem')
  })
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media' || permission === 'mediaKeySystem'
  })
  win.setMenuBarVisibility(false)
  win.loadURL('http://127.0.0.1:' + PORT)
  return win
}

ipcMain.on('restart-app', () => {
  log('redemarrage demande par l\'utilisateur')
  app.relaunch()
  app.quit()
})

app.whenReady().then(async () => {
  log('Electron pret')
  try {
    await startServer()
    log('Serveur OK, creation fenetre')
    createWindow()
  } catch (err) {
    log('ERREUR FATALE: ' + (err.message || err))
    const msg = 'Erreur au demarrage: ' + (err.message || err)
    try {
      const { dialog } = require('electron')
      dialog.showErrorBox('Erreur GestiCom Pro', msg)
    } catch (_) {}
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
