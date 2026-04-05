import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import XLSX from 'xlsx-prototype-pollution-fixed'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()

    const where: {
      date?: { gte: Date; lte: Date }
      magasinId?: number
      type?: string
    } = {}

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) where.magasinId = magId
    }

    if (typeParam && ['ENTREE', 'SORTIE'].includes(typeParam)) {
      where.type = typeParam
    }

    const operations = await prisma.caisse.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    const data = operations.map((op: any) => ({
      Date: new Date(op.date).toLocaleDateString('fr-FR'),
      Type: op.type === 'ENTREE' ? 'Entrée' : 'Sortie',
      Magasin: `${op.magasin.code} - ${op.magasin.nom}`,
      Motif: op.motif,
      Montant: op.montant,
      Utilisateur: op.utilisateur.nom,
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Opérations caisse')

    const colWidths = [
      { wch: 12 }, // Date
      { wch: 12 }, // Type
      { wch: 25 }, // Magasin
      { wch: 30 }, // Motif
      { wch: 15 }, // Montant
      { wch: 20 }, // Utilisateur
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `operations-caisse-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/caisse/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
