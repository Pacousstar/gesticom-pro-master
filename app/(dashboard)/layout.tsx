import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ROLE_PERMISSIONS, type Permission } from '@/lib/roles-permissions'
import DashboardLayoutClient from './DashboardLayoutClient'

export const dynamic = 'force-dynamic'

function getEffectivePermissions(role: string, permissionsPersonnalisees: string | null, rolesSupplementaires: string | null): Permission[] {
  if (permissionsPersonnalisees) {
    try {
      const parsed = JSON.parse(permissionsPersonnalisees)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Permission[]
      }
    } catch {}
  }

  const basePerms = (ROLE_PERMISSIONS as Record<string, Permission[]>)[role] ?? []

  if (rolesSupplementaires) {
    try {
      const parsed = JSON.parse(rolesSupplementaires)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const suppPerms = (parsed as string[]).flatMap((r) => (ROLE_PERMISSIONS as Record<string, Permission[]>)[r] ?? [])
        return [...new Set([...basePerms, ...suppPerms])]
      }
    } catch {}
  }

  return basePerms
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
      select: { permissionsPersonnalisees: true, rolesSupplementaires: true, actif: true },
    })

    if (!userRow || !userRow.actif) {
      redirect('/login?error=deactivated')
    }

    const permissions = getEffectivePermissions(session.role, userRow?.permissionsPersonnalisees ?? null, userRow?.rolesSupplementaires ?? null)

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