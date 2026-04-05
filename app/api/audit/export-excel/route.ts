import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
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
      where.description = { contains: search, mode: 'insensitive' }
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
    })

    const rows = logs.map((log) => ({
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

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Date: '', Utilisateur: '', Login: '', Rôle: '', Action: '', Type: '', Description: '', 'Adresse IP': '', 'User Agent': '', Détails: '' }])
    const colWidths = [
      { wch: 20 }, // Date
      { wch: 20 }, // Utilisateur
      { wch: 15 }, // Login
      { wch: 15 }, // Rôle
      { wch: 15 }, // Action
      { wch: 15 }, // Type
      { wch: 50 }, // Description
      { wch: 18 }, // Adresse IP
      { wch: 40 }, // User Agent
      { wch: 50 }, // Détails
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Journal Audit')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `audit_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel audit:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
