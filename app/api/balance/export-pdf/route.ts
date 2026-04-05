import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

// Fonction pour formater les montants correctement pour jsPDF
function formatMontant(n: number): string {
  const num = Math.round(n)
  // Formatage manuel pour éviter les problèmes avec jsPDF
  const str = num.toString()
  // Ajouter des espaces tous les 3 chiffres en partant de la fin
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

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

    // Si aucune donnée, créer un PDF vide avec un message
    if (result.length === 0) {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Balance des Comptes SYSCOHADA', 15, 20)
      doc.setFontSize(10)
      doc.text('Aucune écriture trouvée pour la période sélectionnée.', 15, 35)
      const pdfOutput = doc.output('arraybuffer') as ArrayBuffer
      const pdfBuffer = Buffer.from(pdfOutput)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="balance-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      })
    }

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 15
    const lineHeight = 6

    // En-tête
    doc.setFontSize(16)
    doc.text('Balance des Comptes SYSCOHADA', margin, y)
    y += 8

    doc.setFontSize(10)
    const dateStr = new Date().toLocaleDateString('fr-FR')
    doc.text(`Date d'export : ${dateStr}`, margin, y)
    y += 5
    if (dateDebut && dateFin) {
      doc.text(`Période : ${dateDebut} au ${dateFin}`, margin, y)
      y += 5
    }
    doc.text(`Total : ${result.length} compte(s)`, margin, y)
    y += 10

    // Tableau
    doc.setFontSize(8)
    let currentY = y
    let currentClasse = ''

    const colW = 195 - margin
    const lineY = (y: number) => { doc.line(margin, y, margin + colW, y) }

    // En-têtes du tableau
    doc.setFont(undefined, 'bold')
    doc.text('Classe', margin, currentY)
    doc.text('Numéro', margin + 20, currentY)
    doc.text('Libellé', margin + 50, currentY)
    doc.text('Type', margin + 110, currentY)
    doc.text('Débit', margin + 130, currentY)
    doc.text('Crédit', margin + 155, currentY)
    doc.text('Solde', margin + 175, currentY)
    currentY += lineHeight
    lineY(currentY - 2)

    doc.setFont(undefined, 'normal')
    for (const entry of result) {
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
        doc.setFont(undefined, 'bold')
        doc.text('Classe', margin, currentY)
        doc.text('Numéro', margin + 20, currentY)
        doc.text('Libellé', margin + 50, currentY)
        doc.text('Type', margin + 110, currentY)
        doc.text('Débit', margin + 130, currentY)
        doc.text('Crédit', margin + 155, currentY)
        doc.text('Solde', margin + 175, currentY)
        currentY += lineHeight
        lineY(currentY - 2)
        doc.setFont(undefined, 'normal')
      }

      if (entry.compte.classe !== currentClasse) {
        currentClasse = entry.compte.classe
        doc.setFont(undefined, 'bold')
        doc.text(`CLASSE ${currentClasse}`, margin, currentY)
        currentY += lineHeight
        doc.setFont(undefined, 'normal')
      }

      const libelle = entry.compte.libelle.length > 20 ? entry.compte.libelle.substring(0, 20) + '...' : entry.compte.libelle

      doc.text(entry.compte.classe, margin, currentY)
      doc.text(entry.compte.numero, margin + 20, currentY)
      doc.text(libelle, margin + 50, currentY)
      doc.text(entry.compte.type, margin + 110, currentY)
      doc.text(entry.soldeDebit > 0 ? formatMontant(entry.soldeDebit) : '—', margin + 130, currentY)
      doc.text(entry.soldeCredit > 0 ? formatMontant(entry.soldeCredit) : '—', margin + 155, currentY)
      doc.text(formatMontant(entry.solde), margin + 175, currentY)

      currentY += lineHeight

      const isLastOfClasse = result.findIndex((e, idx) => idx > result.indexOf(entry) && e.compte.classe === currentClasse) === -1
      if (isLastOfClasse && totauxParClasse[currentClasse]) {
        doc.setFont(undefined, 'bold')
        doc.text(`TOTAL CLASSE ${currentClasse}`, margin + 50, currentY)
        doc.text(formatMontant(totauxParClasse[currentClasse].debit), margin + 130, currentY)
        doc.text(formatMontant(totauxParClasse[currentClasse].credit), margin + 155, currentY)
        currentY += lineHeight
        lineY(currentY - 1)
        currentY += lineHeight
        doc.setFont(undefined, 'normal')
      }
    }

    doc.setFont(undefined, 'bold')
    lineY(currentY - 1)
    currentY += 2
    doc.text('TOTAL GÉNÉRAL', margin + 50, currentY)
    doc.text(formatMontant(totalDebit), margin + 130, currentY)
    doc.text(formatMontant(totalCredit), margin + 155, currentY)

    // Pied de page
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} / ${totalPages}`, 195, pageHeight - 10, { align: 'right' })
      doc.text(`GestiCom - ${dateStr}`, margin, pageHeight - 10)
    }

    const pdfOutput = doc.output('arraybuffer') as ArrayBuffer
    const pdfBuffer = Buffer.from(pdfOutput)
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="balance-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF balance:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
