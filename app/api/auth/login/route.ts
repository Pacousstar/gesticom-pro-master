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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Identifiants requis.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { login, motDePasse } = parsed.data

    const user = await prisma.utilisateur.findFirst({
      where: { login, actif: true },
      select: { id: true, login: true, nom: true, role: true, motDePasse: true, entiteId: true, permissionsPersonnalisees: true },
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

    // Parser les permissions personnalisées (stockées en JSON dans la BDD)
    let customPermissions: string[] | undefined
    if (user.permissionsPersonnalisees) {
      try {
        const parsed = JSON.parse(user.permissionsPersonnalisees)
        if (Array.isArray(parsed)) {
          customPermissions = parsed as string[]
        }
      } catch {
        // Ignorer les permissions malformées
      }
    }

    const token = await createToken({
      userId: user.id,
      login: user.login,
      nom: user.nom,
      role: user.role,
      entiteId: user.entiteId,
      permissions: customPermissions,
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

    // Enregistrer la connexion dans l'audit
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
    const dbUrl = process.env.DATABASE_URL || 'file:C:/gesticom/gesticom.db'
    const hint = `Base: ${dbUrl}. Erreur: ${msg}`
    try {
      const logPath = path.join(process.cwd(), 'gesticom-error.log')
      const logLine = e instanceof Error
        ? (e.stack || e.message || e.name)
        : (e != null && typeof e === 'object' ? JSON.stringify(e).slice(0, 500) : String(e))
      fs.appendFileSync(logPath, new Date().toISOString() + ' [login] ' + logLine + '\n', 'utf8')
    } catch (_) { /* ignore */ }
    return NextResponse.json(
      {
        error: 'Erreur serveur.',
        hint,
      },
      { status: 500 }
    )
  }
}
