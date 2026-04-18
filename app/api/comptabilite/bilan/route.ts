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
        // 1. Déterminer l'entité et le magasin
        const entiteIdFromParams = searchParams.get('entiteId')
        const magasinIdParam = searchParams.get('magasinId')
        let entiteId: number | null = null
        
        if (session.role === 'SUPER_ADMIN') {
            // Fix: S'assurer que entiteId est bien un nombre ou null pour "tous"
            if (entiteIdFromParams && entiteIdFromParams !== 'all') {
                entiteId = parseInt(entiteIdFromParams)
            } else if (entiteIdFromParams === 'all') {
                entiteId = null
            } else {
                // Par défaut, utiliser l'entité de la session ou la première disponible
                entiteId = session.entiteId || 1
            }
        } else {
            entiteId = await getEntiteId(session)
        }

        const whereEcritures: any = {}
        if (entiteId && entiteId > 0) {
            whereEcritures.entiteId = entiteId
        }

        console.log(`[BILAN-API] Diagnostic : User=${session.login}, Role=${session.role}, Entite=${entiteId}, Magasin=${magasinIdParam}`)

        // Ajout du filtrage par magasin
        if (magasinIdParam && magasinIdParam !== 'all') {
            const magId = parseInt(magasinIdParam)
            const [ventesMag, achatsMag] = await Promise.all([
                prisma.vente.findMany({ where: { magasinId: magId }, select: { numero: true } }),
                prisma.achat.findMany({ where: { magasinId: magId }, select: { numero: true } })
            ])
            const pieces = [...ventesMag.map(v => v.numero), ...achatsMag.map(a => a.numero)]
            
            // On filtre par pièce OU les écritures génériques qui n'ont pas de pièce mais qui appartiennent à l'entité
            // Note: Pour un vrai bilan par magasin, il faudrait une colonne magasinId dans EcritureComptable.
            // En attendant, on assouplit pour ne pas retourner "vide".
            if (pieces.length > 0) {
                whereEcritures.OR = [
                    { piece: { in: pieces } },
                    { piece: null } // On inclut les écritures d'OD/Capital pour garder l'équilibre
                ]
            } else {
                // Si aucune pièce, on montre au moins les écritures sans pièce
                whereEcritures.piece = null
            }
        }
        
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

        const totalEntriesCharged = comptes.reduce((sum, c) => sum + (c.ecritures?.length || 0), 0)
        console.log(`[BILAN-API] Écritures chargées : ${totalEntriesCharged} sur ${comptes.length} comptes actifs`)

        // 3. Calculer les soldes
        const accountsWithBalances = comptes.map(compte => {
            const totalDebit = compte.ecritures.reduce((sum, e) => sum + e.debit, 0)
            const totalCredit = compte.ecritures.reduce((sum, e) => sum + e.credit, 0)
            const solde = totalDebit - totalCredit
            return {
                numero: compte.numero.trim(),
                libelle: compte.libelle,
                totalDebit,
                totalCredit,
                solde
            }
        }).filter(c => c.solde !== 0 || c.totalDebit !== 0 || c.totalCredit !== 0)

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
                if (c.solde >= 0) {
                    bilan.actif.tresorerie.push(p)
                    bilan.actif.total += montant
                } else {
                    bilan.passif.tresorerie.push(p)
                    bilan.passif.total += montant
                }
            } else if (prefix === '1') {
                bilan.passif.capitaux.push(p)
                // Attention: Dans le Passif, un solde débiteur en classe 1 (ex: report à nouveau débiteur) 
                // doit normalement venir en déduction des capitaux propres.
                // Ici pour simplifier le Bilan visuel, on ajoute le montant au Passif
                // Mais pour le Résultat Net (13), on fera un ajustement spécifique.
                bilan.passif.total += (c.solde <= 0 ? montant : -montant)
            } 
            // CLASSIFICATION RÉSULTAT (Classes 6, 7 et 8)
            else if (prefix === '7') {
                totalProduits += (c.totalCredit - c.totalDebit)
            } else if (prefix === '6') {
                totalCharges += (c.totalDebit - c.totalCredit)
            } else if (prefix === '8') {
                const soldeNaturel = c.totalCredit - c.totalDebit
                if (soldeNaturel > 0) totalProduits += soldeNaturel
                else totalCharges += Math.abs(soldeNaturel)
            }
        })

        // Calcul du Résultat (Produits - Charges)
        const resultatNet = totalProduits - totalCharges
        
        if (resultatNet !== 0) {
            const isBenefice = resultatNet > 0
            bilan.passif.capitaux.push({
                numero: '13',
                libelle: isBenefice ? 'RÉSULTAT NET : BÉNÉFICE' : 'RÉSULTAT NET : PERTE',
                montant: Math.abs(resultatNet),
                isResultat: true
            })
            // Le résultat s'ajoute au Passif (positif si bénéfice, négatif si perte)
            bilan.passif.total += resultatNet 
        }

        console.log(`[BILAN-API] Total Actif: ${bilan.actif.total}, Total Passif: ${bilan.passif.total}, Résultat: ${resultatNet}`)

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
