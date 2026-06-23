import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { unauthorized, handleApiError } from '@/lib/api-error'

type BilanSection = {
    immobilise: any[]
    stocks: any[]
    creances: any[]
    tresorerie: any[]
    total: number
}

type BilanComplet = {
    actif: BilanSection
    passif: {
        capitaux: any[]
        dettes: any[]
        tresorerie: any[]
        total: number
    }
}

export function buildSection(): BilanSection {
    return { immobilise: [], stocks: [], creances: [], tresorerie: [], total: 0 }
}

export function buildPassifSection(): { capitaux: any[]; dettes: any[]; tresorerie: any[]; total: number } {
    return { capitaux: [], dettes: [], tresorerie: [], total: 0 }
}

export function filtrerZeros(items: any[]): any[] {
    return items.filter(i => i.montant > 0)
}

export async function getBilanForYear(
    entiteId: number,
    annee: number,
    dateDebut?: string | null,
    dateFin?: string | null
): Promise<{
    bilan: BilanComplet
    totalEcritures: number
}> {
    let debut: Date, fin: Date
    if (dateDebut && dateFin) {
        debut = new Date(dateDebut)
        fin = new Date(dateFin)
        fin.setHours(23, 59, 59, 999)
    } else {
        debut = new Date(annee, 0, 1)
        fin = new Date(annee, 11, 31, 23, 59, 59, 999)
    }

    const comptes = await prisma.planCompte.findMany({
        where: { actif: true },
        include: {
            ecritures: {
                where: {
                    date: { gte: debut, lte: fin },
                    ...(entiteId > 0 ? { entiteId } : {}),
                }
            }
        }
    })

    const totalEcritures = comptes.reduce((sum, c) => sum + (c.ecritures?.length || 0), 0)

    const balances = comptes.map(compte => {
        const totalDebit = Math.round(compte.ecritures.reduce((sum, e) => sum + Number(e.debit), 0) * 100) / 100
        const totalCredit = Math.round(compte.ecritures.reduce((sum, e) => sum + Number(e.credit), 0) * 100) / 100
        return {
            numero: compte.numero.trim(),
            libelle: compte.libelle,
            totalDebit,
            totalCredit,
            solde: totalDebit - totalCredit
        }
    })

    const aClassifier = balances.filter(c => {
        const p = c.numero.charAt(0)
        if (p >= '1' && p <= '5') return true
        return c.solde !== 0 || c.totalDebit !== 0 || c.totalCredit !== 0
    })

    const actif = buildSection()
    const passif = buildPassifSection()
    let totalProduits = 0
    let totalCharges = 0

    aClassifier.forEach(c => {
        const montant = Math.abs(c.solde)
        const p = { numero: c.numero, libelle: c.libelle, montant }
        const prefix = c.numero.charAt(0)

        if (prefix === '2') {
            actif.immobilise.push(p)
            actif.total += montant
        } else if (prefix === '3') {
            actif.stocks.push(p)
            actif.total += montant
        } else if (prefix === '4') {
            if (c.solde >= 0) {
                actif.creances.push(p)
                actif.total += montant
            } else {
                passif.dettes.push(p)
                passif.total += montant
            }
        } else if (prefix === '5') {
            if (c.solde >= 0) {
                actif.tresorerie.push(p)
                actif.total += montant
            } else {
                passif.tresorerie.push({
                    numero: c.numero,
                    libelle: c.libelle + ' (découvert)',
                    montant
                })
                passif.total += montant
            }
        } else if (prefix === '1') {
            passif.capitaux.push(p)
            passif.total += Math.abs(c.solde)
        } else if (prefix === '7') {
            totalProduits += (c.totalCredit - c.totalDebit)
        } else if (prefix === '6') {
            totalCharges += (c.totalDebit - c.totalCredit)
        }
    })

    const resultatNet = totalProduits - totalCharges
    if (resultatNet !== 0) {
        passif.capitaux.push({
            numero: '13',
            libelle: resultatNet > 0 ? 'RÉSULTAT NET : BÉNÉFICE' : 'RÉSULTAT NET : PERTE',
            montant: Math.abs(resultatNet),
            isResultat: true
        })
        passif.total += Math.abs(resultatNet)
    }

    actif.immobilise = filtrerZeros(actif.immobilise)
    actif.stocks = filtrerZeros(actif.stocks)
    actif.creances = filtrerZeros(actif.creances)
    actif.tresorerie = filtrerZeros(actif.tresorerie)
    passif.capitaux = filtrerZeros(passif.capitaux)
    passif.dettes = filtrerZeros(passif.dettes)
    passif.tresorerie = filtrerZeros(passif.tresorerie)

    return { bilan: { actif, passif }, totalEcritures }
}

export async function GET(request: Request) {
    try {
        const session = await getSession()
        if (!session) return unauthorized()
        const authError = requirePermission(session, 'comptabilite:view')
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const annee = parseInt(searchParams.get('annee') || '', 10) || new Date().getFullYear()
        const anneePrecedente = annee - 1

        const dateDebut = searchParams.get('dateDebut')
        const dateFin = searchParams.get('dateFin')

        let dateDebutPrec: string | null = null
        let dateFinPrec: string | null = null
        if (dateDebut && dateFin) {
            const d = new Date(dateDebut)
            dateDebutPrec = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).toISOString().split('T')[0]
            const f = new Date(dateFin)
            dateFinPrec = new Date(f.getFullYear() - 1, f.getMonth(), f.getDate()).toISOString().split('T')[0]
        }

        let entiteId = 0
        const entiteIdFromParams = searchParams.get('entiteId')

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
            getBilanForYear(entiteId, annee, dateDebut, dateFin),
            getBilanForYear(entiteId, anneePrecedente, dateDebutPrec, dateFinPrec),
        ])

        const { bilan } = resultN
        const { bilan: bilanPrecedent } = resultN1

        const cumulActifImmobilise = bilan.actif.immobilise.reduce((s, i) => s + i.montant, 0)
        const cumulActifStocks = bilan.actif.stocks.reduce((s, i) => s + i.montant, 0)
        const cumulActifCreances = bilan.actif.creances.reduce((s, i) => s + i.montant, 0)
        const cumulActifTreso = bilan.actif.tresorerie.reduce((s, i) => s + i.montant, 0)
        const cumulPassifCapitaux = bilan.passif.capitaux.reduce((s, i) => s + i.montant, 0)
        const cumulPassifDettes = bilan.passif.dettes.reduce((s, i) => s + i.montant, 0)
        const cumulPassifTreso = bilan.passif.tresorerie.reduce((s, i) => s + i.montant, 0)

        const frng = cumulPassifCapitaux - cumulActifImmobilise
        const bfr = (cumulActifStocks + cumulActifCreances) - cumulPassifDettes
        const tn = cumulActifTreso - cumulPassifTreso

        const [params, entite] = await Promise.all([
            prisma.parametre.findFirst(),
            prisma.entite.findUnique({ where: { id: entiteId } })
        ])

        return NextResponse.json({
            annee,
            entiteId,
            debug: {
                totalEcritures: resultN.totalEcritures,
                debutAnnee: dateDebut && dateFin ? dateDebut : new Date(annee, 0, 1).toISOString().split('T')[0],
                finAnnee: dateDebut && dateFin ? dateFin : new Date(annee, 11, 31, 23, 59, 59, 999).toISOString().split('T')[0],
                dateFiltered: !!(dateDebut && dateFin)
            },
            bilan,
            bilanPrecedent,
            ratios: {
                frng: Math.round(frng),
                bfr: Math.round(bfr),
                tn: Math.round(tn),
                frngLabel: frng >= 0 ? 'Positif (ressources durables > emplois stables)' : 'Négatif (déséquilibre financier)',
                bfrLabel: bfr >= 0 ? 'Besoin de financement du cycle d\'exploitation' : 'Excédent de ressources d\'exploitation',
                tnLabel: tn >= 0 ? 'Trésorerie positive (bonne santé financière)' : 'Découvert bancaire (alerte)',
            },
            entreprise: {
                nom: params?.nomEntreprise || entite?.nom || 'GestiCom',
                slogan: params?.slogan,
                contact: params?.contact,
                localisation: params?.localisation || entite?.localisation,
                codeEntite: entite?.code
            }
        })
    } catch (e) {
        return handleApiError(e)
    }
}
