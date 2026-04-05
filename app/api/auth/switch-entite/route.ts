import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createToken, getCookieName } from '@/lib/auth'
import { cookies } from 'next/headers'

/**
 * Permet à un SUPER_ADMIN de changer d'entité, ou à un utilisateur de revenir à son entité par défaut
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const entiteId = Number(body?.entiteId)

    if (!Number.isInteger(entiteId) || entiteId < 1) {
      return NextResponse.json({ error: 'Entité invalide.' }, { status: 400 })
    }

    // Vérifier que l'entité existe
    const entite = await prisma.entite.findUnique({
      where: { id: entiteId, active: true },
    })

    if (!entite) {
      return NextResponse.json({ error: 'Entité introuvable ou inactive.' }, { status: 400 })
    }

    // Si SUPER_ADMIN, peut changer vers n'importe quelle entité
    // Sinon, peut seulement revenir à son entité par défaut
    if (session.role !== 'SUPER_ADMIN') {
      const user = await prisma.utilisateur.findUnique({
        where: { id: session.userId },
        select: { entiteId: true },
      })
      if (!user || user.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Vous ne pouvez changer que vers votre entité par défaut.' }, { status: 403 })
      }
    }

    // Mettre à jour le token avec la nouvelle entité en préservant les permissions
    const token = await createToken({
      userId: session.userId,
      login: session.login,
      nom: session.nom,
      role: session.role,
      entiteId: entiteId,
      permissions: session.permissions,
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
