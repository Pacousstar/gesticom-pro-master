import crypto from 'crypto'

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwAYkQJ/C6WjzBai+t9tO\ng1ggasoIHqI2CCHaVRamGIzS8lu2HDlfOnys/I9/Q1iWYFKz106A5/KH6aOVSqfU\nbkjnFa3rNUp40entWUbH/d5Q2NFpsTd/L+jZZWHJbkZi8afzDHIaLrSJ57h88lKS\nOMMc+hng+EW7fIY2g+SibRzsEaKIpcMiCV6sLVFNi7964jtGA5rb99/C+UiFAQeK\ntcK8Fn64kKFOJ26537x6zy5fQbkwdRWr9hXnLS1VRC+hg8UEdoCOmrnC4V9P5UEV\nSXbcLeEbampX12RAJEUcBfyL7bImFVzKSQRVmeaWV+GkZSPyqBjVfH2kuvcJpreF\n2wIDAQAB\n-----END PUBLIC KEY-----\n`

export interface LicencePayload {
  client: string
  expire: string | null
  maxVersion: string
  features: string[]
}

export function genererClePrivee(client: string, expire: string | null, maxVersion: string, features: string[]): string {
  throw new Error('Use scripts/generate-license.js instead')
}

export function parserCle(cle: string): { payload: LicencePayload; signature: string } | null {
  const parts = cle.split('-')
  if (parts.length < 3) return null
  const prefix = parts[0]
  if (prefix !== 'GCPRO') return null

  const b64payload = parts[1]
  const signature = parts.slice(2).join('-')

  let payloadStr: string
  try {
    payloadStr = Buffer.from(b64payload, 'base64url').toString('utf-8')
  } catch {
    return null
  }

  let payload: LicencePayload
  try {
    payload = JSON.parse(payloadStr)
  } catch {
    return null
  }

  if (!payload.client || !payload.maxVersion || !Array.isArray(payload.features)) {
    return null
  }

  return { payload, signature }
}

export function verifierSignature(cle: string): boolean {
  const parsed = parserCle(cle)
  if (!parsed) return false

  try {
    const verify = crypto.createVerify('SHA256')
    const parts = cle.split('-')
    const dataToVerify = parts.slice(0, 2).join('-')
    verify.update(dataToVerify)
    return verify.verify(PUBLIC_KEY, parsed.signature, 'base64url')
  } catch {
    return false
  }
}

export function verifierExpiration(payload: LicencePayload): 'VALIDE' | 'EXPIREE' | 'PERPETUELLE' {
  if (!payload.expire) return 'PERPETUELLE'
  const expireDate = new Date(payload.expire)
  return expireDate >= new Date() ? 'VALIDE' : 'EXPIREE'
}

export function verifierVersion(payload: LicencePayload): boolean {
  const currentVersion = '3.4.2'
  const currentParts = currentVersion.split('.').map(Number)
  const maxParts = payload.maxVersion.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if ((currentParts[i] || 0) > (maxParts[i] || 0)) return false
    if ((currentParts[i] || 0) < (maxParts[i] || 0)) return true
  }
  return true
}

export function validerLicence(cle: string): {
  valide: boolean
  statut: string
  payload: LicencePayload | null
  erreur: string | null
} {
  if (!verifierSignature(cle)) {
    return { valide: false, statut: 'INVALIDE', payload: null, erreur: 'Signature invalide' }
  }

  const parsed = parserCle(cle)
  if (!parsed) {
    return { valide: false, statut: 'INVALIDE', payload: null, erreur: 'Format de clé invalide' }
  }

  const expirationStatut = verifierExpiration(parsed.payload)
  if (expirationStatut === 'EXPIREE') {
    return { valide: false, statut: 'EXPIREE', payload: parsed.payload, erreur: 'Licence expirée' }
  }

  if (!verifierVersion(parsed.payload)) {
    return { valide: false, statut: 'VERSION_INCOMPATIBLE', payload: parsed.payload, erreur: `Version max: ${parsed.payload.maxVersion}` }
  }

  return { valide: true, statut: 'ACTIVE', payload: parsed.payload, erreur: null }
}

export function formaterStatutLicence(statut: string): { texte: string; couleur: string } {
  const map: Record<string, { texte: string; couleur: string }> = {
    ACTIVE: { texte: 'Licence valide', couleur: 'text-green-600' },
    EXPIREE: { texte: 'Licence expirée', couleur: 'text-red-600' },
    INVALIDE: { texte: 'Licence invalide', couleur: 'text-orange-600' },
    VERSION_INCOMPATIBLE: { texte: 'Version incompatible', couleur: 'text-yellow-600' },
    PERPETUELLE: { texte: 'Licence perpétuelle', couleur: 'text-blue-600' },
  }
  return map[statut] || { texte: statut, couleur: 'text-gray-600' }
}
