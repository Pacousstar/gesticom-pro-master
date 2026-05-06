import { NextResponse } from 'next/server'
import type { Session } from '@/lib/auth'
import { hasPermission, ROLES_ADMIN, ROLES_COMPTA, ROLES_USER_MANAGEMENT, type Permission, type Role } from './roles-permissions'

// Ré-exporter les constantes depuis roles-permissions pour la rétrocompatibilité
export { ROLES_ADMIN, ROLES_COMPTA, ROLES_USER_MANAGEMENT }

/**
 * Vérifie que la session existe et que le rôle est autorisé.
 * Retourne une NextResponse (401 ou 403) à renvoyer si non autorisé, sinon null.
 */
export function requireRole(
  session: Session | null,
  allowedRoles: readonly string[] | string[]
): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { error: 'Droits insuffisants pour cette action.' },
      { status: 403 }
    )
  }
  return null
}

/**
 * Vérifie que la session existe et que le rôle a la permission requise.
 * Retourne une NextResponse (401 ou 403) à renvoyer si non autorisé, sinon null.
 */
export function requirePermission(
  session: Session | null,
  permission: Permission
): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!hasPermission(session.role as Role, permission, session.permissions)) {
    return NextResponse.json(
      { error: 'Droits insuffisants pour cette action.' },
      { status: 403 }
    )
  }
  return null
}
