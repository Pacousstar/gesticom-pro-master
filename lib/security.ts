import * as crypto from 'crypto'
import * as os from 'os'

const LICENSE_SECRET = process.env.GESTICOM_LICENSE_SECRET || ''

const ENCRYPTION_KEY = process.env.GESTICOM_ENCRYPTION_KEY || 'gesticom-pro-default-key-change!'
const IV_LENGTH = 16

function generateHardwareId(): string {
  try {
    const cpus = os.cpus()
    const hostname = os.hostname()
    const platform = os.platform()
    const arch = os.arch()
    const totalMem = os.totalmem()
    const raw = `${hostname}|${platform}|${arch}|${totalMem}|${cpus.length > 0 ? cpus[0].model : 'unknown'}`
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32)
  } catch {
    return crypto.randomBytes(16).toString('hex')
  }
}

export async function getHardwareId(): Promise<string> {
  return generateHardwareId()
}

export function verifyLicenseKey(hwid: string, key: string): boolean {
  if (!LICENSE_SECRET) return true
  try {
    const expected = crypto.createHmac('sha256', LICENSE_SECRET).update(hwid).digest('hex').substring(0, 24)
    return key === expected
  } catch {
    return false
  }
}

export function ensureActivated(): boolean {
  if (!LICENSE_SECRET) return true
  return true
}

export function encrypt(text: string): string {
  if (!text) return ''
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  } catch {
    return text
  }
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2 || parts[0].length !== IV_LENGTH * 2) {
      return encryptedText
    }
    const iv = Buffer.from(parts[0], 'hex')
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(parts[1], 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText
  }
}