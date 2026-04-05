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
    const compteId = request.nextUrl.searchParams.get('compteId')?.trim()

    const where: {
      date?: { gte: Date; lte: Date }
      compteId?: number
    } = {}

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (compteId) {
      const cId = Number(compteId)
      if (Number.isInteger(cId) && cId > 0) {
        where.compteId = cId
      }
    }

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      orderBy: [{ compteId: 'asc' }, { date: 'asc' }],
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true, type: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    // Grouper par compte
    const grandLivre: Record<number, {
      compte: { numero: string; libelle: string; type: string }
      ecritures: typeof ecritures
      soldeDebit: number
      soldeCredit: number
      solde: number
    }> = {}

    for (const ecriture of ecritures) {
      const compteId = ecriture.compteId
      if (!grandLivre[compteId]) {
        grandLivre[compteId] = {
          compte: ecriture.compte,
          ecritures: [],
          soldeDebit: 0,
          soldeCredit: 0,
          solde: 0,
        }
      }
      grandLivre[compteId].ecritures.push(ecriture)
      grandLivre[compteId].soldeDebit += ecriture.debit
      grandLivre[compteId].soldeCredit += ecriture.credit
    }

    const result = Object.values(grandLivre).map((gl) => {
      let solde = 0
      if (gl.compte.type === 'ACTIF' || gl.compte.type === 'CHARGES') {
        solde = gl.soldeDebit - gl.soldeCredit
      } else {
        solde = gl.soldeCredit - gl.soldeDebit
      }
      return { ...gl, solde }
    })

    // Préparer les données pour Excel
    const rows: any[] = []
    for (const entry of result) {
      // En-tête du compte
      rows.push({
        Compte: `${entry.compte.numero} - ${entry.compte.libelle}`,
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: '',
        Débit: '',
        Crédit: '',
        Solde: '',
      })
      
      // Écritures
      for (const ecriture of entry.ecritures) {
        rows.push({
          Compte: '',
          Date: new Date(ecriture.date).toLocaleDateString('fr-FR'),
          Journal: ecriture.journal.code,
          Pièce: ecriture.piece || '',
          Libellé: ecriture.libelle,
          Débit: ecriture.debit > 0 ? ecriture.debit : '',
          Crédit: ecriture.credit > 0 ? ecriture.credit : '',
          Solde: '',
        })
      }
      
      // Total du compte
      rows.push({
        Compte: '',
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: 'TOTAL',
        Débit: entry.soldeDebit,
        Crédit: entry.soldeCredit,
        Solde: entry.solde,
      })
      
      // Ligne vide
      rows.push({
        Compte: '',
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: '',
        Débit: '',
        Crédit: '',
        Solde: '',
      })
    }

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Compte: '', Date: '', Journal: '', Pièce: '', Libellé: '', Débit: '', Crédit: '', Solde: '' }])
    const colWidths = [
      { wch: 30 }, // Compte
      { wch: 12 }, // Date
      { wch: 12 }, // Journal
      { wch: 12 }, // Pièce
      { wch: 40 }, // Libellé
      { wch: 15 }, // Débit
      { wch: 15 }, // Crédit
      { wch: 15 }, // Solde
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Grand Livre')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `grand-livre_${dateDebut || 'all'}_${dateFin || 'all'}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel grand livre:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
