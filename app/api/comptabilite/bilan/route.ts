import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: Request) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        const authError = requirePermission(session, 'comptabilite:view')
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const annee = parseInt(searchParams.get('annee') || '', 10) || new Date().getFullYear()
        const debutAnnee = new Date(annee, 0, 1)
        const finAnnee = new Date(annee, 11, 31, 23, 59, 59, 999)

        // 1. Déterminer l'entité
        const entiteIdFromParams = searchParams.get('entiteId')
        let entiteId = 0
        
        if (session.role === 'SUPER_ADMIN') {
            if (entiteIdFromParams && entiteIdFromParams !== 'all') {
                entiteId = parseInt(entiteIdFromParams) || 0
            } else {
                // Par défaut, utiliser l'entité de la session
                entiteId = session.entiteId > 0 ? session.entiteId : await getEntiteId(session)
            }
        } else {
            entiteId = await getEntiteId(session)
        }

        // Fallback: utiliser entité 1 si rien trouvé
        if (entiteId <= 0) {
            const firstEntite = await prisma.entite.findFirst({ select: { id: true } })
            entiteId = firstEntite?.id || 1
        }

        console.log(`[BILAN-API] User=${session.login}, Role=${session.role}, Entite=${entiteId}, Annee=${annee}`)

        // 2. Récupérer tous les comptes actifs avec les écritures
        // Simplification: on filtre uniquement par date, pas par entité (le Bilan est global)
        const comptes = await prisma.planCompte.findMany({
            where: { actif: true },
            include: {
                ecritures: {
                    where: {
                        date: { gte: debutAnnee, lte: finAnnee },
                    }
                }
            }
        })

        const totalEcritures = comptes.reduce((sum, c) => sum + (c.ecritures?.length || 0), 0)
        console.log(`[BILAN-API] ${comptes.length} comptes actifs, ${totalEcritures} écritures trouvé pour ${annee}`)

        // Debug: Show first few ecritures if any
        if (totalEcritures === 0) {
            // Check if there are any ecritures at all in DB
            const anyEcritures = await prisma.ecritureComptable.count()
            console.log(`[BILAN-API] Aucune écriture pour ${annee}. Total en base: ${anyEcritures}`)
            
            // Get sample ecritures to help debug
            if (anyEcritures > 0) {
                const samples = await prisma.ecritureComptable.findMany({
                    take: 5,
                    select: { date: true, entiteId: true, libelle: true }
                })
                console.log(`[BILAN-API] Exemples d'écritures en base:`, samples)
            }
        }

        // 3. Calculer les soldes
        const accountsWithBalances = comptes.map(compte => {
            const totalDebit = compte.ecritures.reduce((sum, e) => sum + Number(e.debit), 0)
            const totalCredit = compte.ecritures.reduce((sum, e) => sum + Number(e.credit), 0)
            const solde = totalDebit - totalCredit
            return {
                numero: compte.numero.trim(),
                libelle: compte.libelle,
                totalDebit,
                totalCredit,
                solde
            }
        })

        // Classes 1-5 toujours affichées, classes 6-8 seulement si non-vides
        const accountsToClassify = accountsWithBalances.filter((c) => {
            const prefix = c.numero.charAt(0)
            if (prefix >= '1' && prefix <= '5') return true
            return c.solde !== 0 || c.totalDebit !== 0 || c.totalCredit !== 0
        })

        // 4. Structurer le Bilan (SYSCOHADA)
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

        accountsToClassify.forEach(c => {
            const montant = Math.abs(c.solde)
            const p = { numero: c.numero, libelle: c.libelle, montant }
            const prefix = c.numero.charAt(0)
            
            // CLASSIFICATION BILAN (Classes 1 à 5)
            if (prefix === '2') {
                bilan.actif.immobilise.push(p)
                bilan.actif.total += montant
            } else if (prefix === '3') {
                bilan.actif.stocks.push(p)
                bilan.actif.total += montant
            } else if (prefix === '4') {
                if (c.solde >= 0) {
                    bilan.actif.creances.push(p)
                    bilan.actif.total += montant
                } else {
                    bilan.passif.dettes.push(p)
                    bilan.passif.total += montant
                }
            } else if (prefix === '5') {
                // Trésorerie toujours en actif (découvert = actif avec annotation)
                bilan.actif.tresorerie.push({ 
                    numero: c.numero, 
                    libelle: c.libelle + (c.solde < 0 ? ' (découvert)' : ''), 
                    montant 
                })
                bilan.actif.total += montant
            } else if (prefix === '1') {
                bilan.passif.capitaux.push(p)
                // Toujours additionner la valeur absolue (capitaux propres)
                bilan.passif.total += Math.abs(c.solde)
            } 
            // CLASSIFICATION RÉSULTAT (Classes 6, 7)
            else if (prefix === '7') {
                totalProduits += (c.totalCredit - c.totalDebit)
            } else if (prefix === '6') {
                totalCharges += (c.totalDebit - c.totalCredit)
            }
        })

        // Résultat net
        const resultatNet = totalProduits - totalCharges
        
        if (resultatNet !== 0) {
            const isBenefice = resultatNet > 0
            bilan.passif.capitaux.push({
                numero: '13',
                libelle: isBenefice ? 'RÉSULTAT NET : BÉNÉFICE' : 'RÉSULTAT NET : PERTE',
                montant: Math.abs(resultatNet),
                isResultat: true
            })
            // Ajouter valeur absolue du résultat
            bilan.passif.total += Math.abs(resultatNet)
        }

        console.log(`[BILAN-API] Actif: ${bilan.actif.total}, Passif: ${bilan.passif.total}, Résultat: ${resultatNet}`)

        const [params, entite] = await Promise.all([
            prisma.parametre.findFirst(),
            prisma.entite.findUnique({ where: { id: entiteId } })
        ])

        // Inclure debug info dans réponse
        return NextResponse.json({
            annee,
            entiteId,
            debug: {
                totalEcritures,
                debutAnnee: debutAnnee.toISOString(),
                finAnnee: finAnnee.toISOString()
            },
            bilan,
            entreprise: {
                nom: params?.nomEntreprise || entite?.nom || 'GestiCom',
                slogan: params?.slogan,
                contact: params?.contact,
                localisation: params?.localisation || entite?.localisation,
                codeEntite: entite?.code
            }
        })
    } catch (e) {
        console.error('Bilan API Error:', e)
        return NextResponse.json({ error: 'Erreur lors du calcul du bilan' }, { status: 500 })
    }
}