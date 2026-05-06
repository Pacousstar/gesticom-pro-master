import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'users:view')
  if (authError) return authError

  try {
    const where: any = {}
    if (session?.role !== 'SUPER_ADMIN') {
      where.entiteId = session?.entiteId
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where,
      select: {
        login: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        entite: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const headers = ['Login', 'Nom', 'Email', 'Rôle', 'Entité', 'Statut', 'Dernière connexion', 'Nombre de connexions', 'Date de création']
    const rows = utilisateurs.map(u => [
      u.login,
      u.nom,
      u.email || '',
      u.role,
      u.entite.nom,
      u.actif ? 'Actif' : 'Inactif',
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : '',
      String(u.loginCount),
      new Date(u.createdAt).toLocaleDateString('fr-FR'),
    ])

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
    ].join('\n')

    const response = new NextResponse(csvContent)
    response.headers.set('Content-Type', 'text/csv; charset=utf-8')
    response.headers.set('Content-Disposition', `attachment; filename="utilisateurs_${new Date().toISOString().split('T')[0]}.csv"`)

    return response
  } catch (e) {
    console.error('Export utilisateurs error:', e)
    return NextResponse.json({ error: 'Erreur lors de l\'export.' }, { status: 500 })
  }
}