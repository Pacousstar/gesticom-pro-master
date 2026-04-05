import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'gesticom_session'
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 jours

export type Session = {
  userId: number
  login: string
  nom: string
  role: string
  entiteId: number
  permissions?: string[] // Permissions personnalisées (si définies, remplacent les permissions du rôle)
}

function getSecret(): Uint8Array {
  let s = (process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET)?.trim()
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'development') {
      s = 'GestiCom-Dev-Default-Secret-32chars-Minimum!!'
    } else {
      // Portable ou prod sans .env : utiliser un secret par défaut long (éviter blocage connexion)
      s = 'GestiCom-Portable-ChangeMe-InProduction-32chars!!'
      if (!process.env.SESSION_SECRET) {
        console.warn('[auth] SESSION_SECRET manquant ou trop court. Utilisez une clé d’au moins 32 caractères dans .env')
      }
    }
  }
  return new TextEncoder().encode(s)
}

export async function createToken(payload: Session, maxAge = DEFAULT_MAX_AGE): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.userId || !payload.login || !payload.role) return null
    return {
      userId: Number(payload.userId),
      login: String(payload.login),
      nom: String(payload.nom ?? payload.login),
      role: String(payload.role),
      entiteId: Number(payload.entiteId ?? 0),
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : undefined,
    }
  } catch {
    return null
  }
}

/** Utiliser dans les Server Components et Server Actions. */
export async function getSession(): Promise<Session | null> {
  const c = await cookies()
  const tok = c.get(COOKIE_NAME)?.value
  if (!tok) return null
  return verifyToken(tok)
}

export function getCookieName(): string {
  return COOKIE_NAME
}
