import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'users:view')
  if (authError) return authError

  try {
    const where: any = {}
    if (session?.role !== 'SUPER_ADMIN') {
      where.entiteId = session?.entiteId
    }

    const [rawUtilisateurs, entites] = await Promise.all([
      prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          login: true,
          nom: true,
          email: true,
          role: true,
          permissionsPersonnalisees: true,
          rolesSupplementaires: true,
          actif: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          entiteId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.entite.findMany({
        select: { id: true, nom: true },
      }),
    ])

    const entiteMap = new Map(entites.map(e => [e.id, e]))

    const utilisateurs = rawUtilisateurs.map(u => ({
      ...u,
      entite: entiteMap.get(u.entiteId) || { id: u.entiteId, nom: 'Entité inconnue' },
    }))

    return NextResponse.json(utilisateurs)
  } catch (e) {
    await apiCatch(e, 'api/utilisateurs')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}