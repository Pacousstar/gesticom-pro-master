import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ROLE_PERMISSIONS, type Permission } from '@/lib/roles-permissions'
import DashboardLayoutClient from './DashboardLayoutClient'

// Toutes les pages du dashboard utilisent la session (cookies) : rendu dynamique uniquement.
export const dynamic = 'force-dynamic'

function getEffectivePermissions(role: string, permissionsPersonnalisees: string | null): Permission[] {
  if (permissionsPersonnalisees) {
    try {
      const parsed = JSON.parse(permissionsPersonnalisees)
      if (Array.isArray(parsed)) {
        return parsed as Permission[]
      }
    } catch {
      // Si on n'arrive pas à parser, on fallback sur le rôle
    }
  }
  // Fallback aux permissions du rôle par défaut
  return (ROLE_PERMISSIONS as Record<string, Permission[]>)[role] ?? []
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const session = await getSession()
    if (!session) redirect('/login')

    const userRow = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { permissionsPersonnalisees: true },
    })
    const permissions = getEffectivePermissions(session.role, userRow?.permissionsPersonnalisees ?? null)

    return (
      <DashboardLayoutClient
        user={{ ...session, permissions }}
      >
        {children}
      </DashboardLayoutClient>
    )
  } catch (e) {
    console.error('DashboardLayout error:', e)
    redirect('/login?error=session')
  }
}
