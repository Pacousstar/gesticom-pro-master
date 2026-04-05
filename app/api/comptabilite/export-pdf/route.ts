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

  const type = request.nextUrl.searchParams.get('type') || 'balance' // 'balance' ou 'grand-livre'
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()

  try {
    if (type === 'balance') {
      // Export Balance
      const where: { date?: { gte: Date; lte: Date } } = {}
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

      const totalDebit = result.reduce((sum, entry) => sum + entry.soldeDebit, 0)
      const totalCredit = result.reduce((sum, entry) => sum + entry.soldeCredit, 0)

      const doc = new jsPDF()
      const margin = 20
      const pageHeight = doc.internal.pageSize.height
      const lineHeight = 7
      let y = 20

      doc.setFontSize(18)
      doc.text('Balance Comptable', margin, y)
      y += 10

      doc.setFontSize(10)
      const dateRange = dateDebut && dateFin 
        ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
        : 'Toutes périodes'
      doc.text(dateRange, margin, y)
      y += 10

      doc.setFontSize(9)
      doc.setFont(undefined, 'bold')
      doc.text('Compte', margin, y)
      doc.text('Libellé', margin + 35, y)
      doc.text('Débit', margin + 110, y, { align: 'right' })
      doc.text('Crédit', margin + 140, y, { align: 'right' })
      doc.text('Solde', margin + 170, y, { align: 'right' })
      y += lineHeight
      doc.line(margin, y - 2, 190, y - 2)

      doc.setFont(undefined, 'normal')
      for (const entry of result) {
        if (y > pageHeight - 30) {
          doc.addPage()
          y = 20
        }
        doc.text(entry.compte.numero, margin, y)
        doc.text(entry.compte.libelle.length > 30 ? entry.compte.libelle.substring(0, 30) + '...' : entry.compte.libelle, margin + 35, y)
        doc.text(formatMontant(entry.soldeDebit), margin + 110, y, { align: 'right' })
        doc.text(formatMontant(entry.soldeCredit), margin + 140, y, { align: 'right' })
        doc.text(formatMontant(entry.solde), margin + 170, y, { align: 'right' })
        y += lineHeight
      }

      // Totaux
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 20
      }
      y += 5
      doc.line(margin, y - 2, 190, y - 2)
      doc.setFont(undefined, 'bold')
      doc.text('TOTAUX', margin, y)
      doc.text(formatMontant(totalDebit), margin + 110, y, { align: 'right' })
      doc.text(formatMontant(totalCredit), margin + 140, y, { align: 'right' })

      // Pied de page
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(`Page ${i} / ${totalPages}`, 190, pageHeight - 10, { align: 'right' })
        doc.text(`GestiCom - ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10)
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="balance-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
        },
      })
    } else {
      // Export Grand Livre
      const where: { date?: { gte: Date; lte: Date }; compteId?: number } = {}
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
          journal: { select: { code: true, libelle: true } },
          compte: { select: { numero: true, libelle: true, type: true } },
          utilisateur: { select: { nom: true } },
        },
      })

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

      const doc = new jsPDF()
      const margin = 20
      const pageHeight = doc.internal.pageSize.height
      const lineHeight = 6
      let y = 20

      doc.setFontSize(18)
      doc.text('Grand Livre', margin, y)
      y += 10

      doc.setFontSize(10)
      const dateRange = dateDebut && dateFin 
        ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
        : 'Toutes périodes'
      doc.text(dateRange, margin, y)
      y += 10

      for (const compte of result) {
        if (y > pageHeight - 40) {
          doc.addPage()
          y = 20
        }

        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text(`${compte.compte.numero} - ${compte.compte.libelle}`, margin, y)
        y += 8

        doc.setFontSize(8)
        doc.setFont(undefined, 'bold')
        doc.text('Date', margin, y)
        doc.text('Journal', margin + 30, y)
        doc.text('Pièce', margin + 50, y)
        doc.text('Libellé', margin + 70, y)
        doc.text('Débit', margin + 130, y, { align: 'right' })
        doc.text('Crédit', margin + 150, y, { align: 'right' })
        y += lineHeight
        doc.line(margin, y - 2, 190, y - 2)

        doc.setFont(undefined, 'normal')
        for (const ecriture of compte.ecritures) {
          if (y > pageHeight - 30) {
            doc.addPage()
            y = 20
          }
          const dateStr = new Date(ecriture.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          doc.text(dateStr, margin, y)
          doc.text(ecriture.journal.code, margin + 30, y)
          doc.text(ecriture.piece || '—', margin + 50, y)
          doc.text(ecriture.libelle.length > 25 ? ecriture.libelle.substring(0, 25) + '...' : ecriture.libelle, margin + 70, y)
          doc.text(ecriture.debit > 0 ? formatMontant(ecriture.debit) : '—', margin + 130, y, { align: 'right' })
          doc.text(ecriture.credit > 0 ? formatMontant(ecriture.credit) : '—', margin + 150, y, { align: 'right' })
          y += lineHeight
        }

        // Solde du compte
        y += 3
        doc.line(margin, y - 2, 190, y - 2)
        doc.setFont(undefined, 'bold')
        doc.text('Solde', margin + 100, y)
        doc.text(formatMontant(compte.solde), margin + 150, y, { align: 'right' })
        y += 10
      }

      // Pied de page
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(`Page ${i} / ${totalPages}`, 190, pageHeight - 10, { align: 'right' })
        doc.text(`GestiCom - ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10)
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="grand-livre-${dateDebut || 'all'}-${dateFin || 'all'}.pdf"`,
        },
      })
    }
  } catch (error) {
    console.error('Export PDF comptabilité:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
