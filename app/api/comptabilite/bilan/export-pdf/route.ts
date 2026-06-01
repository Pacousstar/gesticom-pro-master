import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { getBilanForYear } from '../route'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

function formatMontant(n: number): string {
  const num = Math.round(n)
  const str = num.toString()
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'comptabilite:export')
    if (authError) return authError

    const annee =
      parseInt(request.nextUrl.searchParams.get('annee')?.trim() || '', 10) ||
      new Date().getFullYear()

    const dateDebut = request.nextUrl.searchParams.get('dateDebut')
    const dateFin = request.nextUrl.searchParams.get('dateFin')

    let dateDebutPrec: string | null = null
    let dateFinPrec: string | null = null
    if (dateDebut && dateFin) {
      const d = new Date(dateDebut)
      dateDebutPrec = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).toISOString().split('T')[0]
      const f = new Date(dateFin)
      dateFinPrec = new Date(f.getFullYear() - 1, f.getMonth(), f.getDate()).toISOString().split('T')[0]
    }

    let entiteId = 0
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()

    if (session.role === 'SUPER_ADMIN') {
      if (entiteIdFromParams && entiteIdFromParams !== 'all') {
        entiteId = parseInt(entiteIdFromParams) || 0
      } else {
        entiteId = session.entiteId > 0 ? session.entiteId : await getEntiteId(session)
      }
    } else {
      entiteId = await getEntiteId(session)
    }
    if (entiteId <= 0) {
      const firstEntite = await prisma.entite.findFirst({ select: { id: true } })
      entiteId = firstEntite?.id || 1
    }

    const { bilan } = await getBilanForYear(entiteId, annee, dateDebut, dateFin, dateDebutPrec, dateFinPrec)

    const cumulActifImmobilise = bilan.actif.immobilise.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulActifStocks = bilan.actif.stocks.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulActifCreances = bilan.actif.creances.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulActifTreso = bilan.actif.tresorerie.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulPassifCapitaux = bilan.passif.capitaux.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulPassifDettes = bilan.passif.dettes.reduce((s: number, i: any) => s + i.montant, 0)
    const cumulPassifTreso = bilan.passif.tresorerie.reduce((s: number, i: any) => s + i.montant, 0)

    const totalActif = cumulActifImmobilise + cumulActifStocks + cumulActifCreances + cumulActifTreso
    const totalPassif = cumulPassifCapitaux + cumulPassifDettes + cumulPassifTreso

    const frng = cumulPassifCapitaux - cumulActifImmobilise
    const bfr = cumulActifStocks + cumulActifCreances - cumulPassifDettes
    const tn = cumulActifTreso - cumulPassifTreso

    const [params, entite] = await Promise.all([
      prisma.parametre.findFirst(),
      prisma.entite.findUnique({ where: { id: entiteId } }),
    ])

    const entrepriseNom = params?.nomEntreprise || entite?.nom || 'GestiCom'
    const entrepriseContact = params?.contact || ''
    const entrepriseLocalisation = params?.localisation || entite?.localisation || ''

    if (
      bilan.actif.immobilise.length === 0 &&
      bilan.actif.stocks.length === 0 &&
      bilan.actif.creances.length === 0 &&
      bilan.actif.tresorerie.length === 0 &&
      bilan.passif.capitaux.length === 0 &&
      bilan.passif.dettes.length === 0
    ) {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('BILAN COMPTABLE', 105, 20, { align: 'center' })
      doc.setFontSize(10)
      doc.text(`Aucune donnée trouvée pour l'exercice ${annee}.`, 15, 35)
      const pdfOutput = doc.output('arraybuffer') as ArrayBuffer
      const pdfBuffer = Buffer.from(pdfOutput)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="bilan-${annee}.pdf"`,
        },
      })
    }

    const doc = new jsPDF()
    let y = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 15
    const lineH = 6
    const dateStr = new Date().toLocaleDateString('fr-FR')

    const colMid = 101

    // Enterprise header
    doc.setFontSize(13)
    doc.setFont(undefined, 'bold')
    doc.text(entrepriseNom, margin, y)
    y += 6
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    if (entrepriseLocalisation) {
      doc.text(entrepriseLocalisation, margin, y)
      y += 5
    }
    if (entrepriseContact) {
      doc.text(entrepriseContact, margin, y)
      y += 5
    }

    // Title
    y += 4
    doc.setFontSize(15)
    doc.setFont(undefined, 'bold')
    doc.text('BILAN COMPTABLE', 105, y, { align: 'center' })
    y += 7
    doc.setFontSize(11)
    doc.text(`Exercice ${annee}`, 105, y, { align: 'center' })
    y += 8

    // Column headers
    doc.setFontSize(8)
    doc.setFont(undefined, 'bold')
    doc.text('ACTIF', margin, y)
    doc.text('PASSIF', colMid + 4, y)
    y += lineH
    doc.line(margin, y - 1, 195, y - 1)
    y += 2
    doc.setFont(undefined, 'normal')

    // Build actif and passif section data
    const actifSections = [
      { title: 'IMMOBILISATIONS', items: bilan.actif.immobilise, total: cumulActifImmobilise },
      { title: 'STOCKS', items: bilan.actif.stocks, total: cumulActifStocks },
      { title: 'CRÉANCES', items: bilan.actif.creances, total: cumulActifCreances },
      { title: 'TRÉSORERIE', items: bilan.actif.tresorerie, total: cumulActifTreso },
    ]
    const passifSections = [
      { title: 'CAPITAUX PROPRES', items: bilan.passif.capitaux, total: cumulPassifCapitaux },
      { title: 'DETTES', items: bilan.passif.dettes, total: cumulPassifDettes },
      { title: 'TRÉSORERIE PASSIF', items: bilan.passif.tresorerie, total: cumulPassifTreso },
    ]

    // Calculate total lines per column for alignment
    function countLines(sections: any[]): number {
      let c = 0
      for (const s of sections) {
        if (s.items.length === 0) continue
        c += 1 // title
        c += s.items.length // items
        c += 1 // total
        c += 1 // blank line after section
      }
      return c
    }

    const actifLines = countLines(actifSections)
    const passifLines = countLines(passifSections)
    const maxLines = Math.max(actifLines, passifLines)

    // Pre-extract rows for both columns
    const actifRows: (string | null)[][] = []
    for (const s of actifSections) {
      if (s.items.length === 0) continue
      actifRows.push([s.title, null]) // section header
      for (const item of s.items) {
        const label = item.libelle.length > 32 ? item.libelle.substring(0, 32) + '...' : item.libelle
        actifRows.push([item.numero, label, formatMontant(item.montant)])
      }
      actifRows.push(['total', s.title, formatMontant(s.total)])
      actifRows.push([null]) // spacer
    }

    const passifRows: (string | null)[][] = []
    for (const s of passifSections) {
      if (s.items.length === 0) continue
      passifRows.push([s.title, null])
      for (const item of s.items) {
        const label = item.libelle.length > 32 ? item.libelle.substring(0, 32) + '...' : item.libelle
        passifRows.push([item.numero, label, formatMontant(item.montant)])
      }
      passifRows.push(['total', s.title, formatMontant(s.total)])
      passifRows.push([null])
    }

    let actifIdx = 0
    let passifIdx = 0

    while (actifIdx < actifRows.length || passifIdx < passifRows.length) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 20
        doc.setFontSize(8)
        doc.setFont(undefined, 'bold')
        doc.text('ACTIF', margin, y)
        doc.text('PASSIF', colMid + 4, y)
        y += lineH
        doc.line(margin, y - 1, 195, y - 1)
        y += 2
        doc.setFont(undefined, 'normal')
      }

      // Left column row
      if (actifIdx < actifRows.length) {
        const row = actifRows[actifIdx]
        if (row.length === 1 && row[0] === null) {
          // spacer
        } else if (row.length === 2) {
          doc.setFont(undefined, 'bold')
          doc.setFontSize(8)
          doc.text(row[0]!, margin, y)
          doc.setFont(undefined, 'normal')
        } else {
          doc.setFontSize(7)
          doc.text(row[0]!, margin, y)
          doc.text(row[1]!, margin + 14, y)
          doc.text(row[2]!, 95, y, { align: 'right' })
        }
      }

      // Right column row
      if (passifIdx < passifRows.length) {
        const row = passifRows[passifIdx]
        if (row.length === 1 && row[0] === null) {
          // spacer
        } else if (row.length === 2) {
          doc.setFont(undefined, 'bold')
          doc.setFontSize(8)
          doc.text(row[0]!, colMid + 4, y)
          doc.setFont(undefined, 'normal')
        } else {
          doc.setFontSize(7)
          doc.text(row[0]!, colMid + 4, y)
          doc.text(row[1]!, colMid + 18, y)
          doc.text(row[2]!, 190, y, { align: 'right' })
        }
      }

      y += lineH
      actifIdx++
      passifIdx++
    }

    // Grand totals row
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 20
    }
    y += 2
    doc.line(margin, y - 1, 195, y - 1)
    doc.setFont(undefined, 'bold')
    doc.setFontSize(9)
    doc.text('TOTAL ACTIF', margin, y)
    doc.text(formatMontant(totalActif), 95, y, { align: 'right' })
    doc.text('TOTAL PASSIF', colMid + 4, y)
    doc.text(formatMontant(totalPassif), 190, y, { align: 'right' })
    y += lineH + 2
    doc.line(margin, y - 1, 195, y - 1)
    y += 6

    // Ratios
    if (y > pageHeight - 50) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('RATIOS FINANCIERS', margin, y)
    y += 8
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.text(`FRNG (Fonds de Roulement Net Global)  : ${formatMontant(frng)} FCFA`, margin, y)
    const frngLabel = frng >= 0 ? 'Ressources durables > Emplois stables' : 'Déséquilibre financier'
    doc.text(frngLabel, margin + 90, y)
    y += lineH
    doc.text(`BFR  (Besoin en Fonds de Roulement)    : ${formatMontant(bfr)} FCFA`, margin, y)
    const bfrLabel = bfr >= 0 ? 'Besoin de financement du cycle' : 'Excédent de ressources'
    doc.text(bfrLabel, margin + 90, y)
    y += lineH
    doc.text(`TN   (Trésorerie Nette)                : ${formatMontant(tn)} FCFA`, margin, y)
    const tnLabel = tn >= 0 ? 'Trésorerie positive' : 'Découvert bancaire'
    doc.text(tnLabel, margin + 90, y)
    y += lineH + 4

    // Footer
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.text(`Date d'édition : ${dateStr}`, margin, pageHeight - 12)
      doc.text('Document généré par GestiCom Pro', margin, pageHeight - 7)
      doc.text(`Page ${i} / ${totalPages}`, 195, pageHeight - 7, { align: 'right' })
    }

    const pdfOutput = doc.output('arraybuffer') as ArrayBuffer
    const pdfBuffer = Buffer.from(pdfOutput)
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bilan-${annee}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF bilan:', error)
    return NextResponse.json({ error: "Erreur lors de l'export PDF du bilan" }, { status: 500 })
  }
}
