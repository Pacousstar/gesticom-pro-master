import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const limit = Math.min(10000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 5000))
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const journalId = request.nextUrl.searchParams.get('journalId')?.trim()
    const compteId = request.nextUrl.searchParams.get('compteId')?.trim()
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()

    const where: any = {}

    // Filtrage par entité
    if (session.role === 'SUPER_ADMIN') {
      if (entiteIdFromParams) {
        where.entiteId = Number(entiteIdFromParams)
      } else {
        const eId = await getEntiteId(session)
        if (eId > 0) where.entiteId = eId
      }
    } else {
      const eId = await getEntiteId(session)
      if (eId > 0) where.entiteId = eId
    }
    
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (journalId) {
      const jId = Number(journalId)
      if (Number.isInteger(jId) && jId > 0) where.journalId = jId
    }

    if (compteId) {
      const cId = Number(compteId)
      if (Number.isInteger(cId) && cId > 0) where.compteId = cId
    }

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      take: limit,
      orderBy: [{ date: 'desc' }, { numero: 'asc' }],
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    const rows = ecritures.map((e) => ({
      Date: new Date(e.date).toISOString().slice(0, 10),
      Numéro: e.numero,
      Journal: `${e.journal.code} - ${e.journal.libelle}`,
      Pièce: e.piece || '',
      Libellé: e.libelle,
      Compte: `${e.compte.numero} - ${e.compte.libelle}`,
      Débit: e.debit,
      Crédit: e.credit,
      Référence: e.reference || '',
      'Type Réf.': e.referenceType || '',
      Utilisateur: e.utilisateur.nom || e.utilisateur.login,
    }))

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [
      { Date: '', Numéro: '', Journal: '', Pièce: '', Libellé: '', Compte: '', Débit: '', Crédit: '', Référence: '', 'Type Réf.': '', Utilisateur: '' }
    ])
    
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 15 }, // Numéro
      { wch: 20 }, // Journal
      { wch: 15 }, // Pièce
      { wch: 40 }, // Libellé
      { wch: 25 }, // Compte
      { wch: 12 }, // Débit
      { wch: 12 }, // Crédit
      { wch: 15 }, // Référence
      { wch: 15 }, // Type Réf.
      { wch: 20 }, // Utilisateur
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Écritures')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `ecritures_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`.replace(/\s/g, '_')
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel écritures:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
