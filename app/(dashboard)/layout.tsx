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
  const session = await getSession()
  if (!session) redirect('/login')

  try {
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
    // On ne redirige plus ici pour éviter les boucles d'erreur complexes si le catch est déclenché par une erreur de base de données
    return <div className="p-10 text-center text-rose-600 font-black">Erreur de chargement du dashboard. Veuillez nous contacter.</div>
  }
}
