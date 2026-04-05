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

    const where: {
      date?: { gte: Date; lte: Date }
    } = {}

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      orderBy: [{ compteId: 'asc' }, { date: 'asc' }],
      include: {
        compte: { select: { id: true, numero: true, libelle: true, classe: true, type: true } },
      },
    })

    // Grouper par compte
    const balance: Record<number, {
      compte: { id: number; numero: string; libelle: string; classe: string; type: string }
      soldeDebit: number
      soldeCredit: number
      solde: number
    }> = {}

    for (const ecriture of ecritures) {
      const compteId = ecriture.compteId
      if (!balance[compteId]) {
        balance[compteId] = {
          compte: ecriture.compte,
          soldeDebit: 0,
          soldeCredit: 0,
          solde: 0,
        }
      }
      balance[compteId].soldeDebit += ecriture.debit
      balance[compteId].soldeCredit += ecriture.credit
    }

    const result = Object.values(balance)
      .map((b) => {
        let solde = 0
        if (b.compte.type === 'ACTIF' || b.compte.type === 'CHARGES') {
          solde = b.soldeDebit - b.soldeCredit
        } else {
          solde = b.soldeCredit - b.soldeDebit
        }
        return { ...b, solde }
      })
      .sort((a, b) => {
        if (a.compte.classe !== b.compte.classe) {
          return a.compte.classe.localeCompare(b.compte.classe)
        }
        return a.compte.numero.localeCompare(b.compte.numero)
      })

    // Calculer les totaux par classe
    const totauxParClasse: Record<string, { debit: number; credit: number }> = {}
    for (const entry of result) {
      if (!totauxParClasse[entry.compte.classe]) {
        totauxParClasse[entry.compte.classe] = { debit: 0, credit: 0 }
      }
      totauxParClasse[entry.compte.classe].debit += entry.soldeDebit
      totauxParClasse[entry.compte.classe].credit += entry.soldeCredit
    }

    const totalDebit = result.reduce((sum, entry) => sum + entry.soldeDebit, 0)
    const totalCredit = result.reduce((sum, entry) => sum + entry.soldeCredit, 0)

    // Préparer les données pour Excel
    const rows: any[] = []
    let currentClasse = ''
    
    for (const entry of result) {
      if (entry.compte.classe !== currentClasse) {
        currentClasse = entry.compte.classe
        // En-tête de classe
        rows.push({
          Classe: `CLASSE ${currentClasse}`,
          Numéro: '',
          Libellé: '',
          Type: '',
          Débit: '',
          Crédit: '',
          Solde: '',
        })
      }
      
      rows.push({
        Classe: entry.compte.classe,
        Numéro: entry.compte.numero,
        Libellé: entry.compte.libelle,
        Type: entry.compte.type,
        Débit: entry.soldeDebit > 0 ? entry.soldeDebit : '',
        Crédit: entry.soldeCredit > 0 ? entry.soldeCredit : '',
        Solde: entry.solde,
      })
      
      // Total de classe si c'est le dernier de la classe
      const isLastOfClasse = result.findIndex((e, idx) => idx > result.indexOf(entry) && e.compte.classe === currentClasse) === -1
      if (isLastOfClasse && totauxParClasse[currentClasse]) {
        rows.push({
          Classe: '',
          Numéro: '',
          Libellé: `TOTAL CLASSE ${currentClasse}`,
          Type: '',
          Débit: totauxParClasse[currentClasse].debit,
          Crédit: totauxParClasse[currentClasse].credit,
          Solde: '',
        })
        rows.push({
          Classe: '',
          Numéro: '',
          Libellé: '',
          Type: '',
          Débit: '',
          Crédit: '',
          Solde: '',
        })
      }
    }
    
    // Totaux généraux
    rows.push({
      Classe: '',
      Numéro: '',
      Libellé: 'TOTAL GÉNÉRAL',
      Type: '',
      Débit: totalDebit,
      Crédit: totalCredit,
      Solde: '',
    })

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Classe: '', Numéro: '', Libellé: '', Type: '', Débit: '', Crédit: '', Solde: '' }])
    const colWidths = [
      { wch: 10 }, // Classe
      { wch: 15 }, // Numéro
      { wch: 40 }, // Libellé
      { wch: 12 }, // Type
      { wch: 15 }, // Débit
      { wch: 15 }, // Crédit
      { wch: 15 }, // Solde
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Balance')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `balance_${dateDebut || 'all'}_${dateFin || 'all'}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel balance:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
