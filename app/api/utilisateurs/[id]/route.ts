import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { logModification, logSuppression, getIpAddress, getUserAgent } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateUserSchema = z.object({
  nom: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE', 'GESTIONNAIRE', 'MAGASINIER', 'ASSISTANTE']).optional(),
  permissionsPersonnalisees: z.array(z.string()).optional().or(z.null()),
  entiteId: z.number().int().positive().optional(),
  actif: z.boolean().optional(),
  motDePasse: z.string().min(8).max(100).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID utilisateur invalide.' }, { status: 400 })
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
        actif: true,
        entiteId: true,
        createdAt: true,
        entite: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    return NextResponse.json(utilisateur)
  } catch (e) {
    console.error('GET /api/utilisateurs/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

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

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, login: true, nom: true, role: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    // Vérifier que seul SUPER_ADMIN peut modifier un SUPER_ADMIN
    if (existingUser.role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut modifier un Super Administrateur.' }, { status: 403 })
    }

    // Vérifier que seul SUPER_ADMIN peut changer le rôle en SUPER_ADMIN
    if (data.role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut attribuer le rôle Super Administrateur.' }, { status: 403 })
    }

    // Vérifier l'entité si fournie
    if (data.entiteId) {
      const entite = await prisma.entite.findUnique({ where: { id: data.entiteId } })
      if (!entite) {
        return NextResponse.json({ error: 'Entité introuvable.' }, { status: 400 })
      }
    }

    // Vérifier l'email si fourni
    if (data.email !== undefined) {
      const emailValue = data.email === '' ? null : data.email
      if (emailValue) {
        const existingEmail = await prisma.utilisateur.findFirst({
          where: { email: emailValue, NOT: { id } },
        })
        if (existingEmail) {
          return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 400 })
        }
      }
    }

    // Préparer les données de mise à jour
    const updateData: any = {}
    if (data.nom !== undefined) updateData.nom = data.nom
    if (data.email !== undefined) updateData.email = data.email === '' ? null : data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.permissionsPersonnalisees !== undefined) {
      updateData.permissionsPersonnalisees = data.permissionsPersonnalisees === null 
        ? null 
        : JSON.stringify(data.permissionsPersonnalisees)
    }
    if (data.entiteId !== undefined) updateData.entiteId = data.entiteId
    if (data.actif !== undefined) updateData.actif = data.actif
    if (data.motDePasse !== undefined) {
      updateData.motDePasse = await bcrypt.hash(data.motDePasse, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à modifier.' }, { status: 400 })
    }

    // Récupérer les anciennes valeurs pour l'audit
    const anciennesValeurs = {
      nom: existingUser.nom,
      role: existingUser.role,
    }

    // Mettre à jour l'utilisateur
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
        actif: true,
        entiteId: true,
        createdAt: true,
        entite: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    // Logger la modification
    const ipAddress = getIpAddress(request)
    await logModification(
      session!,
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
      },
      ipAddress
    )

    return NextResponse.json(updatedUser)
  } catch (e: unknown) {
    console.error('PATCH /api/utilisateurs/[id]:', e)
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
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID utilisateur invalide.' }, { status: 400 })
  }

  try {
    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, login: true, nom: true, role: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    // Ne pas permettre la suppression de soi-même
    if (session?.userId === id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
    }

    // Vérifier que seul SUPER_ADMIN peut supprimer un SUPER_ADMIN
    if (existingUser.role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut supprimer un Super Administrateur.' }, { status: 403 })
    }

    // Désactiver plutôt que supprimer (soft delete)
    await prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
    })

    // Logger la suppression (désactivation)
    const ipAddress = getIpAddress(request)
    await logSuppression(
      session!,
      'UTILISATEUR',
      id,
      `Désactivation de l'utilisateur ${existingUser.nom} (${existingUser.login})`,
      { login: existingUser.login, nom: existingUser.nom, role: existingUser.role },
      ipAddress
    )

    return NextResponse.json({ message: 'Utilisateur désactivé avec succès.' })
  } catch (e: unknown) {
    console.error('DELETE /api/utilisateurs/[id]:', e)
    const err = e as { code?: string }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
