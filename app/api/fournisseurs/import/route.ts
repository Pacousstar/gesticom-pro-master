import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx-prototype-pollution-fixed'

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

        let created = 0
        let updated = 0

        for (const row of data) {
            const getVal = (keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()))
                return foundKey ? row[foundKey] : null
            }

            const nom = getVal(['nom', 'fournisseur', 'name', 'societe', 'raison sociale'])
            const code = getVal(['code', 'ref', 'reference', 'identifiant'])?.toString()
            const telephone = getVal(['telephone', 'tel', 'phone', 'mobile'])?.toString()
            const adresse = getVal(['adresse', 'address', 'ville', 'quartier'])
            const email = getVal(['email', 'mail', 'courriel'])
            const soldeInitial = Number(getVal(['solde initial', 'solde_initial', 'debit initial', 'dette'])) || 0

            if (!nom) continue

            const existing = await prisma.fournisseur.findFirst({
                where: {
                    OR: [
                        code ? { code } : { id: -1 },
                        { nom: nom.toString() }
                    ]
                }
            })

            if (existing) {
                await prisma.fournisseur.update({
                    where: { id: existing.id },
                    data: {
                        telephone: telephone || existing.telephone,
                        localisation: adresse || existing.localisation,
                        email: email || existing.email,
                        soldeInitial: soldeInitial || existing.soldeInitial,
                    }
                })
                updated++
            } else {
                await prisma.fournisseur.create({
                    data: {
                        nom: nom.toString(),
                        code: code || `FRN-${Date.now().toString().slice(-6)}`,
                        telephone,
                        localisation: adresse,
                        email,
                        soldeInitial,
                        actif: true
                    }
                })
                created++
            }
        }

        return NextResponse.json({ success: true, created, updated, total: data.length })
    } catch (error: any) {
        console.error('[IMPORT_FOURNISSEURS_ERROR]', error)
        return NextResponse.json({ error: error.message || "Erreur lors de l'importation" }, { status: 500 })
    }
}
