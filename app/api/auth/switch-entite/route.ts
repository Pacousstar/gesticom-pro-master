import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createToken, getCookieName } from '@/lib/auth'
import { cookies } from 'next/headers'
import { ROLE_PERMISSIONS } from '@/lib/roles-permissions'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const body = await request.json()
    const entiteId = Number(body?.entiteId)

    if (!Number.isInteger(entiteId) || entiteId < 1) {
      return NextResponse.json({ error: 'Entité invalide.' }, { status: 400 })
    }

    const entite = await prisma.entite.findUnique({
      where: { id: entiteId, active: true },
    })

    if (!entite) {
      return NextResponse.json({ error: 'Entité introuvable ou inactive.' }, { status: 400 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const user = await prisma.utilisateur.findUnique({
        where: { id: session.userId },
        select: { entiteId: true },
      })
      if (!user || user.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Vous ne pouvez changer que vers votre entité par défaut.' }, { status: 403 })
      }
    }

    if (session.role === 'SUPER_ADMIN') {
      await prisma.utilisateur.update({
        where: { id: session.userId },
        data: { entiteId: entiteId },
      })
    }

    const permissionsList = session.permissions && session.permissions.length > 0
      ? session.permissions
      : (ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS] || [])

    const token = await createToken({
      userId: session.userId,
      login: session.login,
      nom: session.nom,
      role: session.role,
      entiteId: entiteId,
      permissions: permissionsList,
      tokenVersion: session.tokenVersion,
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

    return NextResponse.json({ success: true, entite: { id: entite.id, nom: entite.nom, code: entite.code } })
  } catch (e) {
    console.error('Switch entité error:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}