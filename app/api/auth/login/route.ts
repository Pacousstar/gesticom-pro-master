import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { createToken, getCookieName } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import { logConnexion, getIpAddress, getUserAgent } from '@/lib/audit'

const IS_DEV = process.env.NODE_ENV === 'development'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }
  
  record.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIpAddress(request) || 'unknown'
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }
    const body = await request.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Identifiants requis.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { login, motDePasse } = parsed.data

    const user = await prisma.utilisateur.findFirst({
      where: { login, actif: true },
      select: { id: true, login: true, nom: true, role: true, motDePasse: true, entiteId: true, permissionsPersonnalisees: true, rolesSupplementaires: true, tokenVersion: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 })
    }

    let ok: boolean
    try {
      ok = await bcrypt.compare(motDePasse, user.motDePasse)
    } catch {
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 })
    }
    if (!ok) {
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 })
    }

    let customPermissions: string[] | undefined
    if (user.permissionsPersonnalisees) {
      try {
        const parsedPerms = JSON.parse(user.permissionsPersonnalisees)
        if (Array.isArray(parsedPerms)) {
          customPermissions = parsedPerms as string[]
        }
      } catch {}
    } else if (user.rolesSupplementaires) {
      try {
        const suppRoles = JSON.parse(user.rolesSupplementaires)
        if (Array.isArray(suppRoles)) {
          const { ROLE_PERMISSIONS } = await import('@/lib/roles-permissions')
          const basePerms = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []
          const suppPerms = (suppRoles as string[]).flatMap((r: string) => ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS] || [])
          customPermissions = [...new Set([...basePerms, ...suppPerms])]
        }
      } catch {}
    }

    await prisma.utilisateur.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    })

    const token = await createToken({
      userId: user.id,
      login: user.login,
      nom: user.nom,
      role: user.role,
      entiteId: user.entiteId,
      permissions: customPermissions,
      tokenVersion: user.tokenVersion,
    })

    const c = await cookies()
    const isHttps = request.nextUrl.protocol === 'https:'
    c.set(getCookieName(), token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    const ipAddress = getIpAddress(request)
    const userAgent = getUserAgent(request)
    await logConnexion(
      {
        userId: user.id,
        login: user.login,
        nom: user.nom,
        role: user.role,
        entiteId: user.entiteId,
      },
      ipAddress,
      userAgent
    )

    const redirect = parsed.data.redirect ?? '/dashboard'
    return NextResponse.json({ redirect })
  } catch (e: unknown) {
    console.error('Login error:', e)
    let msg = ''
    if (e instanceof Error) {
      msg = e.message || (e as { code?: string }).code || e.name || '(Error)'
    } else if (e != null && typeof e === 'object') {
      const o = e as { message?: string; code?: string; meta?: unknown }
      msg = o.message || o.code || (o.meta ? `meta: ${JSON.stringify(o.meta).slice(0, 150)}` : '') || Object.prototype.toString.call(e)
    } else {
      msg = String(e)
    }
    msg = String(msg).split('\n')[0].slice(0, 320).trim() || '(aucun détail — ouvrez gesticom-error.log dans le dossier)'
    try {
      const logPath = path.join(process.cwd(), 'gesticom-error.log')
      const logLine = e instanceof Error
        ? (e.stack || e.message || e.name)
        : (e != null && typeof e === 'object' ? JSON.stringify(e).slice(0, 500) : String(e))
      fs.appendFileSync(logPath, new Date().toISOString() + ' [login] ' + logLine + '\n', 'utf8')
    } catch (_) { /* ignore */ }
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}