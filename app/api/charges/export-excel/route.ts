import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    const rubriqueParam = request.nextUrl.searchParams.get('rubrique')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()

    const where: any = {}
    
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.entiteId = session.entiteId
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (typeParam && ['FIXE', 'VARIABLE'].includes(typeParam)) {
      where.type = typeParam
    }

    if (rubriqueParam) {
      where.rubrique = rubriqueParam
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) {
        where.magasinId = magId
      }
    }

    const charges = await prisma.charge.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const data = charges.map((c) => ({
      Date: new Date(c.date).toLocaleDateString('fr-FR'),
      Type: c.type,
      Rubrique: c.rubrique,
      Magasin: c.magasin ? `${c.magasin.code} - ${c.magasin.nom}` : '—',
      Montant: c.montant,
      Observation: c.observation || '',
      Utilisateur: c.utilisateur.nom,
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Charges')

    const colWidths = [
      { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 20 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `charges-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/charges/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
