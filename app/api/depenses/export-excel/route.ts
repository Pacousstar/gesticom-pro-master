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
    const categorie = request.nextUrl.searchParams.get('categorie')?.trim()
    const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()

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

    if (categorie) {
      where.categorie = categorie
    }

    if (magasinId) {
      const magId = Number(magasinId)
      if (Number.isInteger(magId) && magId > 0) {
        where.magasinId = magId
      }
    }

    const depenses = await prisma.depense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const data = depenses.map((d) => ({
      Date: new Date(d.date).toLocaleDateString('fr-FR'),
      Catégorie: d.categorie,
      Libellé: d.libelle,
      Magasin: d.magasin ? `${d.magasin.code} - ${d.magasin.nom}` : '—',
      Montant: d.montant,
      'Montant payé': d.montantPaye || 0,
      'Mode paiement': d.modePaiement,
      Bénéficiaire: d.beneficiaire || '',
      Utilisateur: d.utilisateur.nom,
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dépenses')

    const colWidths = [
      { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `depenses-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/depenses/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
