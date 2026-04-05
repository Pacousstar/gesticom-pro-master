import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { createToken, getCookieName, getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { logCreation, getIpAddress, getUserAgent } from '@/lib/audit'
import { z } from 'zod'

const registerSchema = z.object({
  login: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Le login ne peut contenir que des lettres, chiffres, tirets et underscores'),
  nom: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  motDePasse: z.string().min(8).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE', 'GESTIONNAIRE', 'MAGASINIER', 'ASSISTANTE']),
  entiteId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est autorisé
    const session = await getSession()
    const authError = requireRole(session, [...ROLES_ADMIN])
    if (authError) return authError

    const body = await request.json().catch(() => ({}))
    const parsed = registerSchema.safeParse(body)
    
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Données invalides.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { login, nom, email, motDePasse, role, entiteId } = parsed.data

    // Vérifier que l'entité existe
    const entite = await prisma.entite.findUnique({ where: { id: entiteId } })
    if (!entite) {
      return NextResponse.json({ error: 'Entité introuvable.' }, { status: 400 })
    }

    // Vérifier que le login n'existe pas déjà
    const existingLogin = await prisma.utilisateur.findUnique({ where: { login } })
    if (existingLogin) {
      return NextResponse.json({ error: 'Ce login est déjà utilisé.' }, { status: 400 })
    }

    // Vérifier que l'email n'existe pas déjà (si fourni)
    if (email) {
      const existingEmail = await prisma.utilisateur.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 400 })
      }
    }

    // Vérifier que seul SUPER_ADMIN peut créer un SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Seul un Super Administrateur peut créer un Super Administrateur.' }, { status: 403 })
    }

    // Hasher le mot de passe
    const motDePasseHash = await bcrypt.hash(motDePasse, 10)

    // Créer l'utilisateur
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

    // Logger la création
    const ipAddress = getIpAddress(request)
    await logCreation(
      session!,
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
    console.error('Register error:', e)
    let msg = 'Erreur lors de la création de l\'utilisateur.'
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      msg = 'Ce login ou cet email est déjà utilisé.'
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
