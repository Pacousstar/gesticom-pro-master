import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: Request) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const annee = parseInt(searchParams.get('annee') || '', 10) || new Date().getFullYear()

        const finAnnee = new Date(annee, 11, 31, 23, 59, 59, 999)
        // 1. Déterminer l'entité
        const entiteIdFromParams = searchParams.get('entiteId')
        let entiteId: number | null = null
        
        if (session.role === 'SUPER_ADMIN') {
            // Pour le Super Admin, on filtre uniquement si demandé explicitement
            entiteId = entiteIdFromParams ? parseInt(entiteIdFromParams) : null
        } else {
            // Pour les autres, on force l'entité de leur profil
            entiteId = await getEntiteId(session)
        }

        const whereEcritures: any = {}
        if (entiteId && entiteId > 0) {
            whereEcritures.entiteId = entiteId
        }
        
        console.log(`[BILAN] Calcul pour l'année ${annee}, Rôle: ${session.role}, Filtre Entité:`, entiteId || 'TOUTES')

        // 2. Récupérer tous les comptes actifs avec les écritures
        const comptes = await prisma.planCompte.findMany({
            where: { actif: true },
            include: {
                ecritures: {
                    where: {
                        date: { lte: finAnnee },
                        ...whereEcritures
                    }
                }
            }
        })

        const totalEcritures = comptes.reduce((sum, c) => sum + (c.ecritures?.length || 0), 0)
        console.log(`[BILAN] Nombre total d'écritures trouvées dans les comptes: ${totalEcritures}`)

        // 3. Calculer les soldes
        const accountsWithBalances = comptes.map(compte => {
            const totalDebit = compte.ecritures.reduce((sum, e) => sum + e.debit, 0)
            const totalCredit = compte.ecritures.reduce((sum, e) => sum + e.credit, 0)
            const solde = totalDebit - totalCredit
            return {
                numero: compte.numero,
                libelle: compte.libelle,
                totalDebit,
                totalCredit,
                solde
            }
        }).filter(c => c.solde !== 0 || c.totalDebit !== 0 || c.totalCredit !== 0)

        console.log(`[BILAN] Nombre de comptes avec solde non nul: ${accountsWithBalances.length}`)

        // 4. Structurer le Bilan (SYSCOHADA Simplifié)
        const bilan = {
            actif: {
                immobilise: [] as any[],
                stocks: [] as any[],
                creances: [] as any[],
                tresorerie: [] as any[],
                total: 0
            },
            passif: {
                capitaux: [] as any[],
                dettes: [] as any[],
                tresorerie: [] as any[],
                total: 0
            }
        }

        let totalProduits = 0
        let totalCharges = 0

        accountsWithBalances.forEach(c => {
            const p = { numero: c.numero, libelle: c.libelle, montant: Math.abs(c.solde) }

            // CLASSIFICATION BILAN (Classes 1 à 5)
            if (c.numero.startsWith('2')) {
                bilan.actif.immobilise.push(p)
                bilan.actif.total += p.montant
            } else if (c.numero.startsWith('3')) {
                bilan.actif.stocks.push(p)
                bilan.actif.total += p.montant
            } else if (c.numero.startsWith('4')) {
                // Créances si débit (solde > 0), Dettes si crédit (solde < 0)
                if (c.solde >= 0) {
                    bilan.actif.creances.push(p)
                    bilan.actif.total += p.montant
                } else {
                    bilan.passif.dettes.push(p)
                    bilan.passif.total += p.montant
                }
            } else if (c.numero.startsWith('5')) {
                if (c.solde >= 0) {
                    bilan.actif.tresorerie.push(p)
                    bilan.actif.total += p.montant
                } else {
                    bilan.passif.tresorerie.push(p)
                    bilan.passif.total += p.montant
                }
            } else if (c.numero.startsWith('1')) {
                bilan.passif.capitaux.push(p)
                bilan.passif.total += p.montant
            } 
            // CLASSIFICATION RÉSULTAT (Classes 6, 7 et 8)
            else if (c.numero.startsWith('7')) {
                totalProduits += (c.totalCredit - c.totalDebit)
            } else if (c.numero.startsWith('6')) {
                totalCharges += (c.totalDebit - c.totalCredit)
            } else if (c.numero.startsWith('8')) {
                const soldeNaturel = c.totalCredit - c.totalDebit
                if (soldeNaturel > 0) totalProduits += soldeNaturel
                else totalCharges += Math.abs(soldeNaturel)
            }
        })

        // Calcul du Résultat (Produits - Charges)
        const resultatNet = totalProduits - totalCharges
        console.log(`[BILAN] Résultat Net: ${resultatNet} (Produits: ${totalProduits}, Charges: ${totalCharges})`)
        
        if (resultatNet !== 0) {
            bilan.passif.capitaux.push({
                numero: '13',
                libelle: resultatNet > 0 ? 'RÉSULTAT NET : BÉNÉFICE' : 'RÉSULTAT NET : PERTE',
                montant: Math.abs(resultatNet),
                isResultat: true
            })
            // En comptabilité (A=P), le bénéfice s'ajoute au passif, la perte s'y soustrait.
            // On ajoute resultatNet directement pour préserver l'équilibre mathématique total.
            bilan.passif.total += resultatNet 
        }

        const [params, entite] = await Promise.all([
            prisma.parametre.findFirst(),
            prisma.entite.findUnique({ where: { id: entiteId || 1 } })
        ])

        return NextResponse.json({
            annee,
            bilan,
            entreprise: {
                nom: params?.nomEntreprise || entite?.nom || 'GestiCom',
                slogan: params?.slogan,
                contact: params?.contact,
                localisation: params?.localisation || entite?.localisation,
                piedDePage: params?.piedDePage,
                codeEntite: entite?.code,
                numNCC: params?.numNCC,
                logo: params?.logo
            }
        })
    } catch (e) {
        console.error('Bilan API Error:', e)
        return NextResponse.json({ error: 'Erreur lors du calcul du bilan' }, { status: 500 })
    }
}
