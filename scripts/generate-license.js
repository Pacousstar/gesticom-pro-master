const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const PRIVATE_KEY_PATH = path.join(__dirname, '..', 'private.pem')

function genererPairesDeCles() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  fs.writeFileSync(path.join(__dirname, '..', 'private.pem'), privateKey)
  const licensePath = path.join(__dirname, '..', 'lib', 'license.ts')
  let content = fs.readFileSync(licensePath, 'utf-8')
  const newKey = publicKey.replace(/\n/g, '\\n')
  content = content.replace(
    /const PUBLIC_KEY = `[\s\S]*?`/,
    `const PUBLIC_KEY = \`${newKey}\``
  )
  fs.writeFileSync(licensePath, content)

  console.log('✓ Paire de clés générée')
  console.log('✓ private.pem créé (NE PAS COMMIT)')
  console.log('✓ Clé publique mise à jour dans lib/license.ts')
}

function genererLicence(client, expire, maxVersion, features) {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('ERREUR : private.pem introuvable. Exécutez d\'abord :')
    console.error('  node scripts/generate-license.js --init')
    process.exit(1)
  }

  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8')
  const payload = { client, expire, maxVersion, features }
  const payloadStr = JSON.stringify(payload)
  const b64Payload = Buffer.from(payloadStr).toString('base64url')

  const dataToSign = `GCPRO-${b64Payload}`
  const sign = crypto.createSign('SHA256')
  sign.update(dataToSign)
  const signature = sign.sign(privateKey, 'base64url')

  const cle = `GCPRO-${b64Payload}-${signature}`
  console.log('\n=== CLÉ DE LICENCE GÉNÉRÉE ===')
  console.log(cle)
  console.log('=== FIN ===\n')
  console.log('Client :', client)
  console.log('Expire :', expire || 'Jamais (perpétuelle)')
  console.log('Version max :', maxVersion)
  console.log('Fonctionnalités :', features.join(', '))
}

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '--help') {
  console.log(`
Usage:
  node scripts/generate-license.js --init           Générer une paire de clés RSA
  node scripts/generate-license.js <client> [expire] [maxVersion] [features]

Arguments:
  client      Nom du client (obligatoire)
  expire      Date d'expiration (YYYY-MM-DD) ou omettre pour perpétuelle
  maxVersion  Version max autorisée (ex: 3.4.x) [défaut: 3.4.x]
  features    Fonctionnalités séparées par des virgules [défaut: all]

Exemples:
  node scripts/generate-license.js "SARL Test" 2026-12-31 3.4.x
  node scripts/generate-license.js "Client A"  2027-06-30 4.0.x export_pdf,multi_entite
  node scripts/generate-license.js --init
`)
  process.exit(0)
}

if (args[0] === '--init') {
  genererPairesDeCles()
  process.exit(0)
}

const client = args[0]
const expire = args[1] || null
const maxVersion = args[2] || '3.4.x'
const features = args[3] ? args[3].split(',').map(f => f.trim()) : ['all']

genererLicence(client, expire, maxVersion, features)
