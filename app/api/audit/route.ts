import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const utilisateurId = searchParams.get('utilisateurId')
    const action = searchParams.get('action')
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')

    const where: any = {}

    if (utilisateurId) {
      where.utilisateurId = parseInt(utilisateurId)
    }
    if (action) {
      where.action = action
    }
    if (type) {
      where.type = type
    }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo + 'T23:59:59')
      }
    }
    if (search) {
      where.description = { contains: search }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          utilisateur: {
            select: {
              id: true,
              login: true,
              nom: true,
              role: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    const logsWithDetails = logs.map(log => {
      let details = null
      if (log.details) {
        try {
          details = JSON.parse(log.details)
        } catch (e) {
          console.error('Erreur parse details audit log:', e)
          details = null
        }
      }
      
      return {
        id: log.id,
        date: log.date.toISOString(),
        utilisateur: log.utilisateur,
        action: log.action,
        type: log.type,
        entiteId: log.entiteId,
        description: log.description,
        details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      logs: logsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    console.error('GET /api/audit:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
