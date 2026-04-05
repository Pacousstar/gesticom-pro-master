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

        const user = await prisma.utilisateur.findFirst({ 
            where: { role: 'ADMIN' },
            include: { entite: true }
        })
        const magasin = await prisma.magasin.findFirst({ where: { actif: true } })
        
        if (!user || !magasin) return NextResponse.json({ error: 'Utilisateur ADMIN ou Magasin manquant' }, { status: 500 })

        let created = 0
        let total = data.length

        for (const row of data) {
            const getVal = (keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()))
                return foundKey ? row[foundKey] : null
            }

            const numero = getVal(['numero', 'facture', 'ref', 'invoice'])?.toString()
            const dateStr = getVal(['date', 'created_at', 'le'])
            const clientNom = getVal(['client', 'nom client', 'customer', 'destinataire'])?.toString()
            const montantTotal = Number(getVal(['montant total', 'total', 'montant', 'net'])) || 0
            const montantRecu = Number(getVal(['montant recu', 'paye', 'reglement', 'recu', 'ca'])) || montantTotal
            const statut = (getVal(['statut', 'status', 'etat'])?.toString() || 'VALIDEE').toUpperCase()

            if (!numero || !montantTotal) continue

            // Vérifier si la vente existe déjà
            const existing = await prisma.vente.findUnique({ where: { numero } })
            if (existing) continue

            // Trouver ou créer le client libre
            let clientId: number | null = null
            if (clientNom) {
                const c = await prisma.client.findFirst({ where: { nom: clientNom } })
                if (c) clientId = c.id
            }

            await prisma.vente.create({
                data: {
                    numero,
                    date: dateStr ? new Date(dateStr) : new Date(),
                    montantTotal,
                    montantPaye: montantRecu,
                    statut: statut === 'VALIDEE' || statut === 'PAYE' || statut === 'TERMINE' ? 'VALIDEE' : 'ANNULEE',
                    clientId,
                    clientLibre: clientId ? null : clientNom || 'Client Divers',
                    utilisateurId: user.id,
                    entiteId: user.entiteId,
                    magasinId: magasin.id,
                    modePaiement: 'ESPECES',
                    observation: "Importé par Excel",
                    statutPaiement: montantRecu >= montantTotal ? 'PAYE' : 'NON_SOLDER'
                }
            })
            created++
        }

        return NextResponse.json({ success: true, created, total })
    } catch (error: any) {
        console.error('[IMPORT_VENTES_ERROR]', error)
        return NextResponse.json({ error: error.message || "Erreur lors de l'importation" }, { status: 500 })
    }
}
