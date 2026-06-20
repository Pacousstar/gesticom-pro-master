import { NextRequest, NextResponse } from 'next/server'
import { getSession, invalidateUserSessions } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'
import { ROLE_PERMISSIONS, type Role, type Permission } from '@/lib/roles-permissions'
import { strictPasswordSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { apiCatch } from '@/lib/log-error'

const SUPER_ADMIN_PERMS: Set<string> = new Set(ROLE_PERMISSIONS.SUPER_ADMIN)

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000
const RATE_LIMIT_MAX = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (record.count >= RATE_LIMIT_MAX) return false
  record.count++
  return true
}

const updateUserSchema = z.object({
  nom: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE', 'GESTIONNAIRE', 'MAGASINIER', 'ASSISTANTE']).optional(),
  permissionsPersonnalisees: z.array(z.string()).optional().or(z.null()),
  rolesSupplementaires: z.array(z.string()).optional().or(z.null()),
  entiteId: z.number().int().positive().optional(),
  actif: z.boolean().optional(),
  motDePasse: strictPasswordSchema.optional(),
})

function getEffectivePermissions(role: Role, permissionsPersonnalisees: string | null, rolesSupplementaires: string | null): string[] {
  if (permissionsPersonnalisees) {
    try {
      const parsed = JSON.parse(permissionsPersonnalisees)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }

  const basePerms = ROLE_PERMISSIONS[role] || []
  if (!rolesSupplementaires) return [...basePerms]

  try {
    const parsed = JSON.parse(rolesSupplementaires)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const supPerms = parsed.flatMap((r: string) => ROLE_PERMISSIONS[r as Role] || [])
      return [...new Set([...basePerms, ...supPerms])]
    }
  } catch {}

  return [...basePerms]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'users:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID utilisateur invalide.' }, { status: 400 })
  }

  if (session?.role !== 'SUPER_ADMIN') {
    const target = await prisma.utilisateur.findUnique({ where: { id }, select: { entiteId: true } })
    if (target && target.entiteId !== session?.entiteId) {
      return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })
    }
  }

  try {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id },
      select: {
        id: true,
        login: true,
        nom: true,
        email: true,
        role: true,
        permissionsPersonnalisees: true,
        rolesSupplementaires: true,
        actif: true,
        entiteId: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        entite: {
          select: { id: true, nom: true },
        },
      },
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    return NextResponse.json(utilisateur)
  } catch (e) {
    await apiCatch(e, 'api/utilisateurs/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getIpAddress(request) || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  const canEdit = requirePermission(session, 'users:edit')
  if (canEdit) return canEdit

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID utilisateur invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = updateUserSchema.partial().safeParse(body)

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Données invalides.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const data = parsed.data

    const existingUser = await prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, login: true, nom: true, role: true, actif: true, entiteId: true, email: true, permissionsPersonnalisees: true, rolesSupplementaires: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    if (existingUser.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut modifier un Super Administrateur.' }, { status: 403 })
    }

    if (data.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut attribuer le rôle Super Administrateur.' }, { status: 403 })
    }

    if (session.userId === id && data.role && data.role !== session.role) {
      return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }, { status: 403 })
    }

    if (session.userId === id && data.actif === false) {
      return NextResponse.json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }, { status: 403 })
    }

    if (data.rolesSupplementaires !== undefined && data.rolesSupplementaires !== null) {
      const parsedRoles = Array.isArray(data.rolesSupplementaires) ? data.rolesSupplementaires : []
      if (parsedRoles.includes('SUPER_ADMIN') && session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Seul un Super Administrateur peut attribuer les droits Super Administrateur.' }, { status: 403 })
      }
    }

    if (data.entiteId) {
      if (session.role !== 'SUPER_ADMIN') {
        const targetEntiteOk = await prisma.utilisateur.findFirst({
          where: { id, entiteId: session.entiteId },
        })
        if (!targetEntiteOk) {
          return NextResponse.json({ error: 'Vous ne pouvez modifier que les utilisateurs de votre entité.' }, { status: 403 })
        }
        if (data.entiteId !== session.entiteId) {
          return NextResponse.json({ error: 'Droits insuffisants pour changer l\'entité d\'un utilisateur.' }, { status: 403 })
        }
      }
      const entite = await prisma.entite.findUnique({ where: { id: data.entiteId } })
      if (!entite) {
        return NextResponse.json({ error: 'Entité introuvable.' }, { status: 400 })
      }
    }

    if (data.email !== undefined) {
      const emailValue = data.email === '' ? null : data.email
      if (emailValue) {
        const existingEmail = await prisma.utilisateur.findUnique({
          where: { email: emailValue },
        })
        if (existingEmail && existingEmail.id !== id) {
          return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 400 })
        }
      }
    }

    const finalRole = data.role || existingUser.role
    const finalPermsCustom = data.permissionsPersonnalisees !== undefined
      ? (data.permissionsPersonnalisees === null ? null : JSON.stringify(data.permissionsPersonnalisees))
      : existingUser.permissionsPersonnalisees
    const finalRolesSupp = data.rolesSupplementaires !== undefined
      ? (data.rolesSupplementaires === null ? null : JSON.stringify(data.rolesSupplementaires))
      : existingUser.rolesSupplementaires

    if (session.role !== 'SUPER_ADMIN') {
      const effectivePerms = getEffectivePermissions(finalRole as Role, finalPermsCustom, finalRolesSupp)
      const hasSuperAdminPerm = effectivePerms.some(p => SUPER_ADMIN_PERMS.has(p) && !ROLE_PERMISSIONS[session.role as Role]?.includes(p as Permission))
      if (hasSuperAdminPerm) {
        return NextResponse.json({ error: 'Droits insuffisants : les permissions résultantes dépassent vos propres droits.' }, { status: 403 })
      }
    }

    const updateData: any = {}
    if (data.nom !== undefined) updateData.nom = data.nom
    if (data.email !== undefined) updateData.email = data.email === '' ? null : data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.permissionsPersonnalisees !== undefined) {
      updateData.permissionsPersonnalisees = data.permissionsPersonnalisees === null 
        ? null 
        : JSON.stringify(data.permissionsPersonnalisees)
    }
    if (data.rolesSupplementaires !== undefined) {
      updateData.rolesSupplementaires = data.rolesSupplementaires === null
        ? null
        : JSON.stringify(data.rolesSupplementaires)
    }
    if (data.entiteId !== undefined) updateData.entiteId = data.entiteId
    if (data.actif !== undefined) updateData.actif = data.actif
    if (data.motDePasse !== undefined) {
      updateData.motDePasse = await bcrypt.hash(data.motDePasse, 10)
    }

    const roleChanged = data.role !== undefined && data.role !== existingUser.role
    const permsChanged = data.permissionsPersonnalisees !== undefined || data.rolesSupplementaires !== undefined
    const deactivated = data.actif === false && existingUser.actif === true

    if (roleChanged || permsChanged) {
      updateData.tokenVersion = { increment: 1 }
    }
    if (deactivated) {
      updateData.tokenVersion = { increment: 1 }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à modifier.' }, { status: 400 })
    }

    const anciennesValeurs = {
      nom: existingUser.nom,
      role: existingUser.role,
      email: existingUser.email,
      actif: existingUser.actif,
      entiteId: existingUser.entiteId,
      permissionsPersonnalisees: existingUser.permissionsPersonnalisees,
      rolesSupplementaires: existingUser.rolesSupplementaires,
    }

    const updatedUser = await prisma.utilisateur.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        login: true,
        nom: true,
        email: true,
        role: true,
        permissionsPersonnalisees: true,
        rolesSupplementaires: true,
        actif: true,
        entiteId: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        entite: {
          select: { id: true, nom: true },
        },
      },
    })

    const ipAddress = getIpAddress(request)
    await logModification(
      session,
      'UTILISATEUR',
      id,
      `Modification de l'utilisateur ${updatedUser.nom} (${updatedUser.login})`,
      anciennesValeurs,
      {
        nom: updatedUser.nom,
        role: updatedUser.role,
        email: updatedUser.email,
        actif: updatedUser.actif,
        motDePasseModifie: data.motDePasse !== undefined,
        roleChanged,
        permsChanged,
      },
      ipAddress
    )

    return NextResponse.json(updatedUser)
  } catch (e: unknown) {
    await apiCatch(e, 'api/utilisateurs/[id]')
    const err = e as { code?: string }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getIpAddress(request) || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  const canDelete = requirePermission(session, 'users:delete')
  if (canDelete) return canDelete

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID utilisateur invalide.' }, { status: 400 })
  }

  try {
    const existingUser = await prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, login: true, nom: true, role: true, actif: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    if (session.userId === id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }, { status: 400 })
    }

    if (existingUser.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut désactiver un Super Administrateur.' }, { status: 403 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const targetInSameEntity = await prisma.utilisateur.findFirst({
        where: { id, entiteId: session.entiteId },
      })
      if (!targetInSameEntity) {
        return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })
      }
    }

    if (!existingUser.actif) {
      return NextResponse.json({ error: 'Cet utilisateur est déjà désactivé.' }, { status: 400 })
    }

    await prisma.utilisateur.update({
      where: { id },
      data: { actif: false, tokenVersion: { increment: 1 } },
    })

    await invalidateUserSessions(id)

    const ipAddress = getIpAddress(request)
    await logSuppression(
      session,
      'UTILISATEUR',
      id,
      `Désactivation de l'utilisateur ${existingUser.nom} (${existingUser.login})`,
      { login: existingUser.login, nom: existingUser.nom, role: existingUser.role },
      ipAddress
    )

    return NextResponse.json({ message: 'Utilisateur désactivé avec succès.' })
  } catch (e: unknown) {
    await apiCatch(e, 'api/utilisateurs/[id]')
    const err = e as { code?: string }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}