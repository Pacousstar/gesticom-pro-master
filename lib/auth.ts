import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './db'

const COOKIE_NAME = 'gesticom_session'
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7

export type Session = {
  userId: number
  login: string
  nom: string
  role: string
  entiteId: number
  permissions?: string[]
  tokenVersion?: number
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET?.trim()
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET manquant ou trop court (min 32 caractères). Définissez SESSION_SECRET dans votre fichier .env')
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
      tokenVersion: payload.tokenVersion ? Number(payload.tokenVersion) : undefined,
    }
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies()
  const tok = c.get(COOKIE_NAME)?.value
  if (!tok) return null
  const session = await verifyToken(tok)
  if (!session) return null

  if (session.tokenVersion !== undefined) {
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { tokenVersion: true, actif: true },
    })
    if (!user || !user.actif) return null
    if (user.tokenVersion !== session.tokenVersion) return null
  }

  return session
}

export function getCookieName(): string {
  return COOKIE_NAME
}

export async function invalidateUserSessions(userId: number): Promise<void> {
  try {
    await prisma.utilisateur.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
  } catch (error) {
    console.error('Erreur invalidation sessions utilisateur:', error)
  }
}