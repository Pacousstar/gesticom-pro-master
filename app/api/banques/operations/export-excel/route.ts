import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const banqueId = request.nextUrl.searchParams.get('banqueId')?.trim()
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()

    const where: any = {}

    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.banque = { entiteId: session.entiteId }
    }

    if (banqueId) {
      const bId = Number(banqueId)
      if (Number.isInteger(bId) && bId > 0) {
        where.banqueId = bId
      }
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (type) {
      where.type = type
    }

    const operations = await prisma.operationBancaire.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        banque: { select: { numero: true, nomBanque: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    const data = operations.map((op) => {
      const isEntree = op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS'
      const typeLabel = 
        op.type === 'DEPOT' ? 'Dépôt' :
        op.type === 'RETRAIT' ? 'Retrait' :
        op.type === 'VIREMENT_ENTRANT' ? 'Virement entrant' :
        op.type === 'VIREMENT_SORTANT' ? 'Virement sortant' :
        op.type === 'FRAIS' ? 'Frais bancaires' :
        op.type === 'INTERETS' ? 'Intérêts' : op.type

      return {
        Date: new Date(op.date).toLocaleDateString('fr-FR'),
        Type: typeLabel,
        'Compte bancaire': `${op.banque.nomBanque} - ${op.banque.libelle} (${op.banque.numero})`,
        Libellé: op.libelle,
        Référence: op.reference || '',
        Bénéficiaire: op.beneficiaire || '',
        Montant: op.montant,
        'Solde avant': op.soldeAvant,
        'Solde après': op.soldeApres,
        Utilisateur: op.utilisateur.nom,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Opérations bancaires')

    // Ajuster les largeurs des colonnes
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 18 }, // Type
      { wch: 35 }, // Compte bancaire
      { wch: 30 }, // Libellé
      { wch: 15 }, // Référence
      { wch: 20 }, // Bénéficiaire
      { wch: 15 }, // Montant
      { wch: 15 }, // Solde avant
      { wch: 15 }, // Solde après
      { wch: 20 }, // Utilisateur
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `operations-bancaires-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/banques/operations/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
