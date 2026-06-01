import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { getBilanForYear } from '../route'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'comptabilite:export')
    if (authError) return authError

    const annee =
      parseInt(request.nextUrl.searchParams.get('annee')?.trim() || '', 10) ||
      new Date().getFullYear()
    const anneePrecedente = annee - 1

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

    const [resultN, resultN1] = await Promise.all([
      getBilanForYear(entiteId, annee, dateDebut, dateFin, dateDebutPrec, dateFinPrec),
      getBilanForYear(entiteId, anneePrecedente, dateDebutPrec, dateFinPrec, dateDebutPrec, dateFinPrec),
    ])

    const { bilan } = resultN
    const { bilan: bilanPrecedent } = resultN1

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

    const getMontant = (section: any[], compteNumero: string): number => {
      const item = section.find((i: any) => i.numero === compteNumero)
      return item ? item.montant : 0
    }

    const actifRows: any[] = []

    const actifSections: { title: string; items: any[]; itemsN1: any[] }[] = [
      { title: 'IMMOBILISATIONS', items: bilan.actif.immobilise, itemsN1: bilanPrecedent.actif.immobilise },
      { title: 'STOCKS', items: bilan.actif.stocks, itemsN1: bilanPrecedent.actif.stocks },
      { title: 'CRÉANCES', items: bilan.actif.creances, itemsN1: bilanPrecedent.actif.creances },
      { title: 'TRÉSORERIE', items: bilan.actif.tresorerie, itemsN1: bilanPrecedent.actif.tresorerie },
    ]

    for (const s of actifSections) {
      if (s.items.length === 0) continue
      actifRows.push({ Compte: '', Libellé: s.title, 'Montant N': '', 'Montant N-1': '' })
      for (const item of s.items) {
        const montantN1 = getMontant(s.itemsN1, item.numero)
        actifRows.push({
          Compte: item.numero,
          Libellé: item.libelle,
          'Montant N': item.montant,
          'Montant N-1': montantN1,
        })
      }
    }

    actifRows.push({ Compte: '', Libellé: 'TOTAL ACTIF', 'Montant N': totalActif, 'Montant N-1': 0 })

    const passifRows: any[] = []

    const passifSections: { title: string; items: any[]; itemsN1: any[] }[] = [
      { title: 'CAPITAUX PROPRES', items: bilan.passif.capitaux, itemsN1: bilanPrecedent.passif.capitaux },
      { title: 'DETTES', items: bilan.passif.dettes, itemsN1: bilanPrecedent.passif.dettes },
      { title: 'TRÉSORERIE PASSIF', items: bilan.passif.tresorerie, itemsN1: bilanPrecedent.passif.tresorerie },
    ]

    for (const s of passifSections) {
      if (s.items.length === 0) continue
      passifRows.push({ Compte: '', Libellé: s.title, 'Montant N': '', 'Montant N-1': '' })
      for (const item of s.items) {
        const montantN1 = getMontant(s.itemsN1, item.numero)
        passifRows.push({
          Compte: item.numero,
          Libellé: item.libelle,
          'Montant N': item.montant,
          'Montant N-1': montantN1,
        })
      }
    }

    passifRows.push({ Compte: '', Libellé: 'TOTAL PASSIF', 'Montant N': totalPassif, 'Montant N-1': 0 })

    const frngLabel = frng >= 0 ? 'Positif (ressources durables > emplois stables)' : 'Négatif (déséquilibre financier)'
    const bfrLabel = bfr >= 0 ? 'Besoin de financement du cycle d\'exploitation' : 'Excédent de ressources d\'exploitation'
    const tnLabel = tn >= 0 ? 'Trésorerie positive (bonne santé financière)' : 'Découvert bancaire (alerte)'

    const ratioRows = [
      { Indicateur: 'FRNG (Fonds de Roulement Net Global)', Valeur: frng, Interprétation: frngLabel },
      { Indicateur: 'BFR (Besoin en Fonds de Roulement)', Valeur: bfr, Interprétation: bfrLabel },
      { Indicateur: 'TN (Trésorerie Nette)', Valeur: tn, Interprétation: tnLabel },
    ]

    const wsActif = XLSX.utils.json_to_sheet(actifRows.length ? actifRows : [{ Compte: '', Libellé: '', 'Montant N': '', 'Montant N-1': '' }])
    const wsPassif = XLSX.utils.json_to_sheet(passifRows.length ? passifRows : [{ Compte: '', Libellé: '', 'Montant N': '', 'Montant N-1': '' }])
    const wsRatios = XLSX.utils.json_to_sheet(ratioRows)

    const colWidths = [
      { wch: 15 }, // Compte
      { wch: 50 }, // Libellé
      { wch: 18 }, // Montant N
      { wch: 18 }, // Montant N-1
    ]
    wsActif['!cols'] = colWidths
    wsPassif['!cols'] = colWidths

    const ratioColWidths = [
      { wch: 45 }, // Indicateur
      { wch: 18 }, // Valeur
      { wch: 55 }, // Interprétation
    ]
    wsRatios['!cols'] = ratioColWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsActif, 'Bilan Actif')
    XLSX.utils.book_append_sheet(wb, wsPassif, 'Bilan Passif')
    XLSX.utils.book_append_sheet(wb, wsRatios, 'Ratios')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `bilan_${annee}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export Excel bilan:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel du bilan' }, { status: 500 })
  }
}
