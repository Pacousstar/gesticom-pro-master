import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { genererExportSage } from '@/lib/formats/sage'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  const forbidden = requirePermission(session, 'comptabilite:view')
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const type = searchParams.get('type') // "SAGE" | "EXCEL"

    const where: any = {}
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      include: {
        journal: true,
        compte: true
      },
      orderBy: { date: 'asc' }
    })

    // Transformation pour le format Sage attendu par la lib
    const mappedEcritures = ecritures.map(e => ({
      date: e.date,
      journalCode: e.journal.code,
      compteGeneral: e.compte.numero,
      libelle: e.libelle,
      debit: e.debit,
      credit: e.credit
    }))

    if (type === 'SAGE') {
      const content = genererExportSage(mappedEcritures)
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename=export-sage-${dateDebut || 'tout'}.txt`
        }
      })
    }

    // Par défaut/Excel (CSV simple)
    const csvContent = "Date;Journal;Compte;Libelle;Debit;Credit\n" + 
      mappedEcritures.map(e => `${e.date.toISOString().split('T')[0]};${e.journalCode};${e.compteGeneral};${e.libelle};${e.debit};${e.credit}`).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=export-comptable-${dateDebut || 'tout'}.csv`
      }
    })

  } catch (e) {
    console.error('Export Pro Error:', e)
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'export' }, { status: 500 })
  }
}
