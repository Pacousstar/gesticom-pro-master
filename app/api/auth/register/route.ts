import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { logCreation, getIpAddress } from '@/lib/audit'
import { z } from 'zod'
import { strictPasswordSchema } from '@/lib/validations'
import { apiCatch } from '@/lib/log-error'

const registerSchema = z.object({
  login: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Le login ne peut contenir que des lettres, chiffres, tirets et underscores'),
  nom: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  motDePasse: strictPasswordSchema,
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE', 'GESTIONNAIRE', 'MAGASINIER', 'ASSISTANTE']),
  entiteId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

    const authError = requirePermission(session, 'users:create')
    if (authError) return authError

    if (session.role !== 'SUPER_ADMIN') {
      if (session.role === 'ADMIN') {
        const body = await request.json().catch(() => ({}))
        if (body.entiteId && body.entiteId !== session.entiteId) {
          return NextResponse.json({ error: 'Vous ne pouvez créer des utilisateurs que dans votre entité.' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Droits insuffisants pour cette action.' }, { status: 403 })
      }
    }

    const rawBody = await request.json().catch(() => ({}))
    const parsed = registerSchema.safeParse(rawBody)
    
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Données invalides.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { login, nom, email, motDePasse, role, entiteId } = parsed.data

    if (role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut créer un Super Administrateur.' }, { status: 403 })
    }

    if (session.role === 'ADMIN' && entiteId !== session.entiteId) {
      return NextResponse.json({ error: 'Vous ne pouvez créer des utilisateurs que dans votre entité.' }, { status: 403 })
    }

    const entite = await prisma.entite.findUnique({ where: { id: entiteId } })
    if (!entite) {
      return NextResponse.json({ error: 'Entité introuvable.' }, { status: 400 })
    }

    const existingLogin = await prisma.utilisateur.findUnique({ where: { login } })
    if (existingLogin) {
      return NextResponse.json({ error: 'Ce login est déjà utilisé.' }, { status: 400 })
    }

    if (email) {
      const existingEmail = await prisma.utilisateur.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 400 })
      }
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 10)

    const user = await prisma.utilisateur.create({
      data: {
        login,
        nom,
        email: email || null,
        motDePasse: motDePasseHash,
        role,
        entiteId,
        actif: true,
      },
      select: {
        id: true,
        login: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
      },
    })

    const ipAddress = getIpAddress(request)
    await logCreation(
      session,
      'UTILISATEUR',
      user.id,
      `Utilisateur ${user.nom} (${user.login}) - Rôle: ${role}`,
      { login, nom, email, role, entiteId },
      ipAddress
    )

    return NextResponse.json({ 
      message: 'Utilisateur créé avec succès.',
      user 
    }, { status: 201 })
  } catch (e: unknown) {
    await apiCatch(e, 'api/auth/register')
    let msg = 'Erreur lors de la création de l\'utilisateur.'
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      msg = 'Ce login ou cet email est déjà utilisé.'
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}