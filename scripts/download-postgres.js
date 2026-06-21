const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')

const PG_VERSION = '16.14-2'
const ZIP_NAME = `postgresql-${PG_VERSION}-windows-x64-binaries.zip`
const DEST_DIR = path.join(__dirname, '..', 'pgsql')
const DEST_PATH = path.join(DEST_DIR, ZIP_NAME)
const URL = `https://get.enterprisedb.com/postgresql/${ZIP_NAME}`

function log(msg) { console.log(`[postgres-dl] ${msg}`) }

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    log(`Téléchargement de ${url}...`)
    const req = https.get(url, { timeout: 600000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlinkSync(dest)
        log(`Redirect vers ${res.headers.location}`)
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const total = parseInt(res.headers['content-length'], 10)
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (total) {
          const pct = Math.round((received / total) * 100)
          process.stdout.write(`\r  ${pct}% (${(received / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo)`)
        }
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve() })
    })
    req.on('error', (err) => { file.close(); fs.unlinkSync(dest, () => {}); reject(err) })
    req.setTimeout(600000, () => { req.destroy(); reject(new Error('Timeout 10min')) })
  })
}

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true })

  if (fs.existsSync(DEST_PATH)) {
    const size = (fs.statSync(DEST_PATH).size / 1024 / 1024).toFixed(1)
    log(`${ZIP_NAME} déjà présent (${size} Mo)`)
    return
  }

  log(`Téléchargement de PostgreSQL ${PG_VERSION} (310 Mo)...`)
  try {
    await download(URL, DEST_PATH)
    const size = (fs.statSync(DEST_PATH).size / 1024 / 1024).toFixed(1)
    log(`Téléchargement terminé (${size} Mo)`)
  } catch (err) {
    log(`ERREUR: ${err.message}`)
    log('Téléchargez manuellement depuis https://www.enterprisedb.com/downloads/postgres-postgresql-downloads')
    process.exit(1)
  }
}

main()
