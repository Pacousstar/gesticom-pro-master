import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx-prototype-pollution-fixed'
import { Buffer } from 'buffer'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const formData = await req.formData()
        const file = formData.get('file') as Blob
        if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(sheet) as any[]

        if (data.length === 0) return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })

        // 1. Ne charger que les magasins de l'entité
        const magasins = await prisma.magasin.findMany({ 
            where: { 
                actif: true,
                entiteId: session.entiteId 
            } 
        })
        let created = 0
        let updated = 0
        let stocksCreated = 0

        for (const row of data) {
            const getVal = (keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()))
                return foundKey ? row[foundKey] : null
            }

            const designation = getVal(['designation', 'nom', 'produit', 'article', 'description'])
            const code = getVal(['code', 'ref', 'reference', 'sku'])?.toString()
            const categorieName = getVal(['categorie', 'category', 'famille', 'groupe'])?.toString() || 'DIVERS'
            const prixAchat = Number(getVal(['prix achat', 'pa', 'prix_achat', 'achat'])) || 0
            const prixVente = Number(getVal(['prix vente', 'pv', 'prix_vente', 'vente'])) || 0
            const seuilMin = Number(getVal(['seuil min', 'seuil', 'alerte', 'min'])) || 5
            const stockInitial = getVal(['stock initial', 'stock', 'quantite', 'qte'])

            if (!designation || !code) continue

            // 2. Gérer le produit
            const existing = await prisma.produit.findUnique({
                where: { code }
            })

            let produitId: number

            if (existing) {
                // Vérifier si le produit appartient bien à la même entité
                if (existing.entiteId !== session.entiteId) {
                    console.warn(`[IMPORT_PRODUIT] Conflit de code : ${code} appartient à une autre entité.`)
                    continue 
                }

                const p = await prisma.produit.update({
                    where: { id: existing.id },
                    data: {
                        designation: designation.toString(),
                        categorie: categorieName,
                        prixAchat,
                        prixVente,
                        seuilMin,
                    }
                })
                produitId = p.id
                updated++
            } else {
                const p = await prisma.produit.create({
                    data: {
                        designation: designation.toString(),
                        code,
                        categorie: categorieName,
                        prixAchat,
                        prixVente,
                        seuilMin,
                        entiteId: session.entiteId, // Rattaché à l'entité de l'utilisateur
                        actif: true
                    }
                })
                produitId = p.id
                created++
            }

            // 3. Gérer le stock (au sein de l'entité)
            if (stockInitial !== null && stockInitial !== undefined) {
                const qte = Number(stockInitial) || 0
                for (const m of magasins) {
                    await prisma.stock.upsert({
                        where: {
                            produitId_magasinId: {
                                produitId,
                                magasinId: m.id
                            }
                        },
                        update: {
                            quantite: qte 
                        },
                        create: {
                            produitId,
                            magasinId: m.id,
                            quantite: qte,
                            entiteId: session.entiteId // Rattaché à l'entité
                        }
                    })
                    stocksCreated++
                }
            }
        }

        return NextResponse.json({ success: true, created, updated, total: data.length, stocksCreated })
    } catch (error: any) {
        console.error('[IMPORT_PRODUITS_ERROR]', error)
        return NextResponse.json({ error: error.message || "Erreur lors de l'importation" }, { status: 500 })
    }
}
