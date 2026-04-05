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
      grandLivre[compteId].soldeDebit += Number(ecriture.debit) || 0
      grandLivre[compteId].soldeCredit += Number(ecriture.credit) || 0
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

    // Si aucune donnée, créer un PDF vide avec un message
    if (result.length === 0) {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Grand Livre SYSCOHADA', 15, 20)
      doc.setFontSize(10)
      doc.text('Aucune écriture trouvée pour la période sélectionnée.', 15, 35)
      const pdfOutput = doc.output('arraybuffer') as ArrayBuffer
      const pdfBuffer = Buffer.from(pdfOutput)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="grand-livre-${new Date().toISOString().slice(0, 10)}.pdf"`,
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
    doc.text('Grand Livre SYSCOHADA', margin, y)
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

    for (const entry of result) {
      if (currentY > pageHeight - 40) {
        doc.addPage()
        currentY = 20
      }

      // En-tête du compte
      doc.setFont(undefined, 'bold')
      doc.text(`${entry.compte.numero} - ${entry.compte.libelle}`, margin, currentY)
      currentY += lineHeight

      // En-têtes du tableau
      doc.setFont(undefined, 'bold')
      doc.text('Date', margin, currentY)
      doc.text('Journal', margin + 30, currentY)
      doc.text('Pièce', margin + 50, currentY)
      doc.text('Libellé', margin + 70, currentY)
      doc.text('Débit', margin + 130, currentY)
      doc.text('Crédit', margin + 155, currentY)
      currentY += lineHeight
      doc.line(margin, currentY - 2, 195, currentY - 2)

      doc.setFont(undefined, 'normal')
      for (const ecriture of entry.ecritures) {
        if (currentY > pageHeight - 30) {
          doc.addPage()
          currentY = 20
        }

        const dateFormatted = new Date(ecriture.date).toLocaleDateString('fr-FR')
        const libelle = ecriture.libelle.length > 25 ? ecriture.libelle.substring(0, 25) + '...' : ecriture.libelle

        doc.text(dateFormatted, margin, currentY)
        doc.text(ecriture.journal.code, margin + 30, currentY)
        doc.text(ecriture.piece || '—', margin + 50, currentY)
        doc.text(libelle, margin + 70, currentY)
        doc.text(ecriture.debit > 0 ? formatMontant(ecriture.debit) : '—', margin + 130, currentY)
        doc.text(ecriture.credit > 0 ? formatMontant(ecriture.credit) : '—', margin + 155, currentY)

        currentY += lineHeight
      }

      // Total du compte
      doc.setFont(undefined, 'bold')
      doc.text('TOTAL', margin + 70, currentY)
      doc.text(formatMontant(entry.soldeDebit), margin + 130, currentY)
      doc.text(formatMontant(entry.soldeCredit), margin + 155, currentY)
      currentY += lineHeight * 2
    }

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
        'Content-Disposition': `attachment; filename="grand-livre-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF grand livre:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
