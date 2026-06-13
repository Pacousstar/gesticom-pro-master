import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

const EXPORT_MAX_ROWS = 10000

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'audit:view')
  if (authError) return authError

  try {
    const searchParams = request.nextUrl.searchParams
    const utilisateurId = searchParams.get('utilisateurId')
    const action = searchParams.get('action')
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')

    const where: any = {}

    if (session?.role !== 'SUPER_ADMIN') {
      where.entiteId = session?.entiteId
    }

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
      where.OR = [
        { description: { contains: search } },
        { type: { contains: search } },
        { action: { contains: search } },
      ]
    }

    const totalCount = await prisma.auditLog.count({ where })

    if (totalCount > EXPORT_MAX_ROWS) {
      return NextResponse.json({ 
        error: `Trop de données à exporter (${totalCount} lignes). Maximum ${EXPORT_MAX_ROWS} lignes. Veuillez appliquer des filtres plus restrictifs.` 
      }, { status: 400 })
    }

    const logs = await prisma.auditLog.findMany({
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
      take: EXPORT_MAX_ROWS,
    })

    const rows: any[] = logs.map((log) => ({
      Date: new Date(log.date).toLocaleString('fr-FR'),
      Utilisateur: log.utilisateur.nom,
      Login: log.utilisateur.login,
      Rôle: log.utilisateur.role,
      Action: log.action,
      Type: log.type,
      Description: log.description,
      'Adresse IP': log.ipAddress || '',
      'User Agent': log.userAgent || '',
      Détails: log.details ? JSON.stringify(log.details) : '',
    }))

    if (rows.length > 0) {
      rows.push({ Date: '', Utilisateur: '', Login: '', Rôle: '', Action: '', Type: 'Total lignes', Description: rows.length, 'Adresse IP': '', 'User Agent': '', Détails: '' })
    }

    const buf = await rowsToBuffer(rows as any[], 'Journal Audit')
    const filename = `audit_${new Date().toISOString().slice(0, 10)}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('Export Excel audit:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}