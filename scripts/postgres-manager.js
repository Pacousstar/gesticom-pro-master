const fs = require('fs')
const path = require('path')
const { spawnSync, execSync } = require('child_process')
const https = require('https')

const PG_VERSION = '18.4-2'
const ZIP_NAME = `postgresql-${PG_VERSION}-windows-x64-binaries.zip`
const DL_URL = `https://github.com/pacousstar/GestiCom-Pro/releases/download/pg-stable/${ZIP_NAME}`

function log(msg) {
  try {
    fs.appendFileSync(path.join(process.env.GESTICOM_USER_DATA || __dirname, 'pg-manager.log'), new Date().toISOString() + ' ' + msg + '\n')
  } catch (_) {}
}

function findPostgresBin(dataDir) {
  const candidates = [
    path.join(dataDir, 'pgsql', 'bin', 'pg_ctl.exe'),
    path.join(__dirname, '..', 'pgsql', 'bin', 'pg_ctl.exe'),
    'C:\\PostgreSQL\\pgsql\\bin\\pg_ctl.exe',
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_ctl.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return path.dirname(p)
  }
  return null
}

function findPostgresData(dataDir) {
  const candidates = [
    path.join(dataDir, 'pgdata'),
    'C:\\PostgreSQL\\data',
  ]
  for (const p of candidates) {
    const pgHba = path.join(p, 'pg_hba.conf')
    if (fs.existsSync(pgHba)) return p
  }
  return null
}

function isPostgresRunning(pgBinDir, pgDataDir) {
  try {
    if (pgDataDir) {
      const r = spawnSync(path.join(pgBinDir, 'pg_ctl.exe'), ['status', '-D', pgDataDir], {
        stdio: 'pipe', timeout: 5000, windowsHide: true,
      })
      return r.status === 0
    }
    const r = spawnSync(path.join(pgBinDir, 'pg_isready.exe'), ['-q'], { stdio: 'pipe', timeout: 5000, windowsHide: true })
    return r.status === 0
  } catch { return false }
}

function findLocalZip() {
  const candidates = [
    path.join(__dirname, '..', ZIP_NAME),
    path.join(__dirname, '..', '..', ZIP_NAME),
    path.join(process.env.PORTABLE_EXECUTABLE_DIR || '', ZIP_NAME),
    path.join(process.cwd(), ZIP_NAME),
    'C:\\PostgreSQL\\' + ZIP_NAME,
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) { log('zip trouve localement: ' + p); return p }
  }
  return null
}

function isZipValid(zipPath) {
  try {
    const st = fs.statSync(zipPath)
    if (!st.isFile() || st.size < 50 * 1024 * 1024) return false
    const fd = fs.openSync(zipPath, 'r')
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
  } catch { return false }
}

async function downloadWithRetry(dataDir, onProgress, attempts = 3) {
  let lastErr = null
  for (let i = 1; i <= attempts; i++) {
    try {
      const zipPath = await downloadPostgres(dataDir, onProgress)
      if (!isZipValid(zipPath)) throw new Error('Archive invalide ou incomplete: ' + zipPath)
      return zipPath
    } catch (e) {
      lastErr = e
      log('[auto] Tentative ' + i + '/' + attempts + ' echouee: ' + e.message)
      try { fs.unlinkSync(path.join(dataDir, 'pgsql', ZIP_NAME)) } catch (_) {}
    }
  }
  throw new Error('Telechargement PostgreSQL echoue apres ' + attempts + ' tentatives (' + (lastErr?.message || 'erreur inconnue') + ')')
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const net = require('net')
    const srv = net.createServer()
    srv.once('error', () => { srv.close(); resolve(false) })
    srv.listen(port, '127.0.0.1', () => { srv.close(() => resolve(true)) })
  })
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const next = (p) => {
      if (p > startPort + 20) return reject(new Error('Aucun port libre trouve entre ' + startPort + ' et ' + (startPort + 20)))
      const srv = net.createServer()
      srv.once('error', () => { srv.close(); next(p + 1) })
      srv.listen(p, '127.0.0.1', () => { srv.close(() => resolve(p)) })
    }
    next(startPort)
  })
}

function getConfiguredPort(pgDataDir) {
  try {
    const conf = fs.readFileSync(path.join(pgDataDir, 'postgresql.conf'), 'utf-8')
    const m = conf.match(/^\s*port\s*=\s*(\d+)/m)
    if (m) return parseInt(m[1], 10)
  } catch (_) {}
  return 5432
}

function setConfiguredPort(pgDataDir, port) {
  const confPath = path.join(pgDataDir, 'postgresql.conf')
  let conf = fs.readFileSync(confPath, 'utf-8')
  if (/^\s*port\s*=\s*\d+/m.test(conf)) {
    conf = conf.replace(/^\s*port\s*=\s*\d+/m, 'port = ' + port)
  } else if (/^#\s*port\s*=\s*\d+/m.test(conf)) {
    conf = conf.replace(/^#\s*port\s*=\s*\d+/m, 'port = ' + port)
  } else {
    conf += '\nport = ' + port + '\n'
  }
  fs.writeFileSync(confPath, conf, 'utf-8')
  log('[auto] Port configure dans postgresql.conf: ' + port)
}

function stopLegacyGesticomPostgres() {
  const legacyCtl = 'C:\\PostgreSQL\\pgsql\\bin\\pg_ctl.exe'
  const legacyData = 'C:\\PostgreSQL\\data'
  if (fs.existsSync(legacyCtl) && fs.existsSync(legacyData)) {
    try {
      log('[auto] Arret instance legacy C:\\PostgreSQL (pg_ctl)')
      spawnSync(legacyCtl, ['-D', legacyData, 'stop', '-m', 'fast'], { stdio: 'pipe', timeout: 15000, windowsHide: true })
    } catch (_) {}
  }
  try {
    const ps = spawnSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      "Get-Process postgres -ErrorAction SilentlyContinue | Where-Object { $_.Path -like 'C:\\PostgreSQL\\*' } | Stop-Process -Force -ErrorAction SilentlyContinue",
    ], { stdio: 'pipe', timeout: 20000, windowsHide: true })
    log('[auto] Anciennes instances legacy GestiCom arretees')
  } catch (_) {}
}

function downloadPostgres(dataDir, onProgress) {
  const destDir = path.join(dataDir, 'pgsql')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  const zipPath = path.join(destDir, ZIP_NAME)

  const localZip = findLocalZip()
  if (localZip) {
    log('copie du zip local: ' + localZip)
    fs.copyFileSync(localZip, zipPath)
    return zipPath
  }

  if (fs.existsSync(zipPath) && isZipValid(zipPath)) {
    log('zip deja telecharge: ' + zipPath)
    return zipPath
  }
  if (fs.existsSync(zipPath)) {
    log('zip partiel/corrompu, re-telechargement: ' + zipPath)
    try { fs.unlinkSync(zipPath) } catch (_) {}
  }

  log('Telechargement de PostgreSQL ' + PG_VERSION + '...')
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath)
    const req = https.get(DL_URL, { timeout: 600000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); try { fs.unlinkSync(zipPath) } catch (_) {}
        return downloadPostgresDirect(res.headers.location, zipPath, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(zipPath) } catch (_) {}
        return reject(new Error('HTTP ' + res.statusCode))
      }
      const total = parseInt(res.headers['content-length'], 10)
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress && total) onProgress(Math.round((received / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        const size = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0
        if (!total || size >= total) {
          log('Telechargement termine (' + size + ' octets)')
          resolve(zipPath)
        } else {
          log('Telechargement incomplet: ' + size + '/' + total)
          try { fs.unlinkSync(zipPath) } catch (_) {}
          reject(new Error('Telechargement incomplet (' + size + '/' + total + ' octets)'))
        }
      })
    })
    req.on('error', (e) => { file.close(); try { fs.unlinkSync(zipPath) } catch (_) {}; reject(e) })
    req.setTimeout(600000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function downloadPostgresDirect(url, zipPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath)
    https.get(url, { timeout: 600000 }, (res) => {
      const total = parseInt(res.headers['content-length'], 10)
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress && total) onProgress(Math.round((received / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(zipPath) })
    }).on('error', (e) => { file.close(); try { fs.unlinkSync(zipPath) } catch (_) {}; reject(e) })
  })
}

function extractPostgres(dataDir, zipPath) {
  const destDir = path.join(dataDir, 'pgsql')
  const binDir = path.join(destDir, 'bin')

  if (fs.existsSync(path.join(binDir, 'pg_ctl.exe'))) {
    log('PostgreSQL deja extrait')
    return destDir
  }

  log('Extraction de PostgreSQL...')
  try {
    execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}')"`, {
      timeout: 300000, stdio: 'pipe',
    })
    log('Extraction terminee')
  } catch (e) {
    throw new Error('Extraction echouee: ' + e.message)
  }

  const pgsqlSubdir = path.join(destDir, 'pgsql')
  if (fs.existsSync(pgsqlSubdir)) {
    const entries = fs.readdirSync(pgsqlSubdir)
    for (const e of entries) {
      fs.renameSync(path.join(pgsqlSubdir, e), path.join(destDir, e))
    }
    try { fs.rmdirSync(pgsqlSubdir) } catch (_) {}
  }

  const timezonesets = path.join(destDir, 'share', 'timezonesets')
  if (!fs.existsSync(timezonesets)) {
    fs.mkdirSync(timezonesets, { recursive: true })
    const tzData = [
      'CET 3600', 'CEST 7200', 'EET 7200', 'EEST 10800',
      'WET 0', 'WEST 3600', 'GMT 0', 'BST 3600', 'UTC 0',
      'EST -18000', 'EDT -14400', 'CST -21600', 'CDT -18000',
      'MST -25200', 'MDT -21600', 'PST -28800', 'PDT -25200',
      'HST -36000', 'AKST -32400', 'AKDT -28800',
      'JST 32400', 'KST 32400', 'IST 19800', 'CCT 28800',
    ].join('\n')
    fs.writeFileSync(path.join(timezonesets, 'Default'), tzData, 'ascii')
    log('timezonesets/Default cree')
  }

  return destDir
}

function initPostgres(pgBinDir, pgDataDir) {
  if (fs.existsSync(path.join(pgDataDir, 'pg_hba.conf'))) {
    log('PostgreSQL deja initialise')
    return true
  }

  if (!fs.existsSync(pgDataDir)) fs.mkdirSync(pgDataDir, { recursive: true })

  log('Initialisation du cluster PostgreSQL...')
  const initdb = path.join(pgBinDir, 'initdb.exe')
  if (!fs.existsSync(initdb)) throw new Error('initdb introuvable: ' + initdb)

  const r = spawnSync(initdb, ['-D', pgDataDir, '-U', 'postgres', '-A', 'trust', '--locale=C'], {
    stdio: 'pipe', timeout: 60000, windowsHide: true,
  })
  if (r.status !== 0) {
    throw new Error('initdb echoue: ' + (r.stderr?.toString() || '').slice(0, 300))
  }
  log('Cluster initialise')
  return true
}

function startPostgres(pgBinDir, pgDataDir) {
  if (isPostgresRunning(pgBinDir, pgDataDir)) {
    log('PostgreSQL deja demarre')
    return true
  }

  const pidFile = path.join(pgDataDir, 'postmaster.pid')
  if (fs.existsSync(pidFile)) {
    log('Fichier postmaster.pid obsolet detecte, nettoyage...')
    try { fs.unlinkSync(pidFile) } catch (_) {}
  }

  const pgCtl = path.join(pgBinDir, 'pg_ctl.exe')
  const logFile = path.join(pgDataDir, 'pg.log')

  log('Demarrage PostgreSQL...')
  const r = spawnSync(pgCtl, ['-D', pgDataDir, '-l', logFile, 'start'], {
    stdio: 'pipe', timeout: 30000, windowsHide: true,
  })
  if (r.status !== 0) {
    log('pg_ctl start sortie: ' + (r.stderr?.toString() || '').slice(0, 200))
    if (isPostgresRunning(pgBinDir, pgDataDir)) {
      log('PostgreSQL semble deja demarre malgre l erreur')
      return true
    }
    throw new Error('pg_ctl start echoue: ' + (r.stderr?.toString() || '').slice(0, 300))
  }

  let attempts = 0
  while (attempts < 10) {
    if (isPostgresRunning(pgBinDir, pgDataDir)) {
      log('PostgreSQL demarre')
      return true
    }
    require('child_process').execSync('timeout /t 1 /nobreak >nul 2>nul', { stdio: 'pipe' })
    attempts++
  }
  throw new Error('PostgreSQL ne demarre pas apres 10s')
}

function stopPostgres(pgBinDir, pgDataDir) {
  if (!isPostgresRunning(pgBinDir, pgDataDir)) return true

  const pgCtl = path.join(pgBinDir, 'pg_ctl.exe')
  log('Arret PostgreSQL...')
  spawnSync(pgCtl, ['-D', pgDataDir, 'stop'], { stdio: 'pipe', timeout: 30000, windowsHide: true })
  log('PostgreSQL arrete')
  return true
}

function findAdminUser(pgBinDir, port) {
  const psql = path.join(pgBinDir, 'psql.exe')
  const candidates = ['postgres', 'gesticom', 'administrator', 'sa']
  for (const user of candidates) {
    const r = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(port), '-U', user, '-d', 'postgres', '-tAc', 'SELECT 1'], {
      stdio: 'pipe', timeout: 5000, windowsHide: true,
    })
    if (r.status === 0) return user
  }
  throw new Error('Aucun utilisateur PostgreSQL superadmin trouve')
}

function createDatabase(pgBinDir, port) {
  const psql = path.join(pgBinDir, 'psql.exe')
  if (!fs.existsSync(psql)) throw new Error('psql introuvable: ' + psql)

  const adminUser = findAdminUser(pgBinDir, port)
  log('Utilisateur admin PostgreSQL: ' + adminUser + ' (port ' + port + ')')

  const checkUser = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(port), '-U', adminUser, '-tAc', "SELECT 1 FROM pg_roles WHERE rolname='gesticom'"], {
    stdio: 'pipe', timeout: 10000, windowsHide: true,
  })
  if (checkUser.status === 0 && checkUser.stdout.toString().trim() === '1') {
    log('Utilisateur gesticom existe deja')
  } else {
    log('Creation utilisateur gesticom...')
    const r = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(port), '-U', adminUser, '-c', "CREATE USER gesticom WITH PASSWORD 'gesticom123' CREATEDB;"], {
      stdio: 'pipe', timeout: 10000, windowsHide: true,
    })
    if (r.status !== 0) throw new Error('Creation user echouee: ' + (r.stderr?.toString() || '').slice(0, 200))
    log('Utilisateur gesticom cree')
  }

  const checkDb = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(port), '-U', adminUser, '-tAc', "SELECT 1 FROM pg_database WHERE datname='gesticom'"], {
    stdio: 'pipe', timeout: 10000, windowsHide: true,
  })
  if (checkDb.status === 0 && checkDb.stdout.toString().trim() === '1') {
    log('Base gesticom existe deja')
  } else {
    log('Creation base gesticom...')
    const r = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(port), '-U', adminUser, '-c', 'CREATE DATABASE gesticom OWNER gesticom;'], {
      stdio: 'pipe', timeout: 10000, windowsHide: true,
    })
    if (r.status !== 0) throw new Error('Creation db echouee: ' + (r.stderr?.toString() || '').slice(0, 200))
    log('Base gesticom cree')
  }

  return { host: 'localhost', port, database: 'gesticom', user: 'gesticom', password: 'gesticom123' }
}

async function ensurePostgres(dataDir, port = 5432) {
  const pgBinDir = findPostgresBin(dataDir)

  if (!pgBinDir) {
    log('PostgreSQL non trouve, telechargement...')
    const zipPath = await downloadWithRetry(dataDir)
    extractPostgres(dataDir, zipPath)
    const newBinDir = findPostgresBin(dataDir)
    if (!newBinDir) throw new Error('PostgreSQL introuvable apres extraction')
    const pgDataDir = path.join(dataDir, 'pgdata')
    initPostgres(newBinDir, pgDataDir)
    startPostgres(newBinDir, pgDataDir)
    const creds = createDatabase(newBinDir, port)
    return { pgBinDir: newBinDir, pgDataDir, creds, installed: true }
  }

  const pgDataDir = findPostgresData(dataDir) || path.join(dataDir, 'pgdata')

  if (!fs.existsSync(path.join(pgDataDir, 'pg_hba.conf'))) {
    initPostgres(pgBinDir, pgDataDir)
  }

  startPostgres(pgBinDir, pgDataDir)

  const creds = createDatabase(pgBinDir, port)

  return { pgBinDir, pgDataDir, creds, installed: false }
}

function findAutoPostgresBin(dataDir) {
  const ourPaths = [
    path.join(dataDir, 'pgsql', 'bin', 'pg_ctl.exe'),
    path.join(__dirname, '..', 'pgsql', 'bin', 'pg_ctl.exe'),
  ]
  for (const p of ourPaths) {
    if (fs.existsSync(p)) return path.dirname(p)
  }
  return null
}

async function ensureAutoPostgres(dataDir) {
  stopLegacyGesticomPostgres()

  let pgBinDir = findAutoPostgresBin(dataDir)

  if (!pgBinDir) {
    log('[auto] PostgreSQL non trouve, telechargement...')
    const zipPath = await downloadWithRetry(dataDir, (pct) => log('[auto] Telechargement: ' + pct + '%'))
    extractPostgres(dataDir, zipPath)
    pgBinDir = findAutoPostgresBin(dataDir)
    if (!pgBinDir) throw new Error('PostgreSQL introuvable apres extraction')
  } else {
    log('[auto] PostgreSQL deja installe')
  }

  const pgDataDir = path.join(dataDir, 'pgdata')

  if (!fs.existsSync(path.join(pgDataDir, 'pg_hba.conf'))) {
    initPostgres(pgBinDir, pgDataDir)
  }

  if (!isPostgresRunning(pgBinDir, pgDataDir)) {
    let port = getConfiguredPort(pgDataDir)
    if (!(await isPortFree(port))) {
      const newPort = await findFreePort(port + 1)
      log('[auto] Port ' + port + ' occupe, demarrage sur le port ' + newPort)
      setConfiguredPort(pgDataDir, newPort)
      port = newPort
    }
    startPostgres(pgBinDir, pgDataDir)
  }

  const port = getConfiguredPort(pgDataDir)
  const creds = createDatabase(pgBinDir, port)

  return { pgBinDir, pgDataDir, creds, installed: true }
}

module.exports = {
  findPostgresBin, findPostgresData, isPostgresRunning,
  downloadPostgres, extractPostgres, initPostgres,
  startPostgres, stopPostgres, createDatabase, ensurePostgres,
  ensureAutoPostgres,
  isZipValid, downloadWithRetry, isPortFree, findFreePort,
  getConfiguredPort, setConfiguredPort, stopLegacyGesticomPostgres,
}
