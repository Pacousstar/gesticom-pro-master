import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const rawUtilisateurs = await prisma.utilisateur.findMany({
      select: {
        id: true,
        login: true,
        nom: true,
        email: true,
        role: true,
        permissionsPersonnalisees: true,
        actif: true,
        createdAt: true,
        entiteId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const entites = await prisma.entite.findMany({
      select: { id: true, nom: true }
    })
    const entiteMap = new Map(entites.map(e => [e.id, e]))

    const utilisateurs = rawUtilisateurs.map(u => ({
      ...u,
      entite: entiteMap.get(u.entiteId) || { id: u.entiteId, nom: 'Entité inconnue' }
    }))

    return NextResponse.json(utilisateurs)
  } catch (e) {
    console.error('GET /api/utilisateurs:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
