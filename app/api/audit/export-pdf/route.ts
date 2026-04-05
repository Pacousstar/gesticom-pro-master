import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

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

    if (session && session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.entiteId = session.entiteId
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
      take: 1000, // Limiter à 1000 logs pour le PDF
    })

    const parametres = await prisma.parametre.findFirst()
    const nomEntreprise = parametres?.nomEntreprise || 'GESTICOM PRO'

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 15
    const lineHeight = 6

    // En-tête
    doc.setFontSize(16)
    doc.text(`Journal d'Audit - ${nomEntreprise}`, margin, y)
    y += 8

    doc.setFontSize(10)
    const dateStr = new Date().toLocaleDateString('fr-FR')
    doc.text(`Date d'export : ${dateStr}`, margin, y)
    y += 5
    doc.text(`Total : ${logs.length} log(s)`, margin, y)
    y += 10

    // Tableau
    doc.setFontSize(8)
    let currentY = y

    // En-têtes du tableau
    doc.setFont(undefined, 'bold')
    doc.text('Date', margin, currentY)
    doc.text('Utilisateur', margin + 35, currentY)
    doc.text('Action', margin + 70, currentY)
    doc.text('Type', margin + 95, currentY)
    doc.text('Description', margin + 115, currentY)
    currentY += lineHeight
    doc.line(margin, currentY - 2, 195, currentY - 2)

    doc.setFont(undefined, 'normal')
    for (const log of logs) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      const dateFormatted = new Date(log.date).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const user = `${log.utilisateur.nom} (${log.utilisateur.login})`
      const description = log.description && log.description.length > 30 ? log.description.substring(0, 30) + '...' : (log.description || '')

      doc.text(dateFormatted, margin, currentY)
      doc.text(user.length > 20 ? user.substring(0, 20) + '...' : user, margin + 35, currentY)
      doc.text(log.action, margin + 70, currentY)
      doc.text(log.type, margin + 95, currentY)
      doc.text(description, margin + 115, currentY)

      currentY += lineHeight
    }

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 195, pageHeight - 10, { align: 'right' })
      doc.text(`GestiCom - ${dateStr}`, margin, pageHeight - 10)
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF audit:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
