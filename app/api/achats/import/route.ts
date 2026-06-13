import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseExcel } from '@/lib/excel'
import { requireRole } from '@/lib/require-role'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        const forbidden = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
        if (forbidden) return forbidden

        const formData = await req.formData()
        const file = formData.get('file') as Blob
        if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        const { rows: data } = await parseExcel(buffer)

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

            const numero = getVal(['numero', 'facture', 'ref', 'bon'])?.toString()
            const dateStr = getVal(['date', 'created_at', 'le'])?.toString()
            const fournisseurNom = getVal(['fournisseur', 'nom fournisseur', 'supplier', 'expediteur'])?.toString()
            const montantTotal = Number(getVal(['montant total', 'total', 'montant', 'net'])) || 0
            const statut = (getVal(['statut', 'status', 'etat'])?.toString() || 'VALIDEE').toUpperCase()

            if (!numero || !montantTotal) continue

            const existing = await prisma.achat.findUnique({ where: { numero } })
            if (existing) continue

            let fournisseurId: number | null = null
            if (fournisseurNom) {
                const f = await prisma.fournisseur.findFirst({ where: { nom: fournisseurNom } })
                if (f) fournisseurId = f.id
            }

            await prisma.achat.create({
                data: {
                    numero,
                    date: dateStr ? new Date(dateStr) : new Date(),
                    montantTotal,
                    montantPaye: montantTotal,
                    statutPaiement: 'PAYE',
                    fournisseurId,
                    fournisseurLibre: fournisseurId ? null : fournisseurNom || 'Fournisseur Divers',
                    utilisateurId: user.id,
                    entiteId: user.entiteId,
                    magasinId: magasin.id,
                    modePaiement: 'ESPECES',
                    observation: "Importé par Excel"
                }
            })
            created++
        }

        return NextResponse.json({ success: true, created, total })
    } catch (error: any) {
        console.error('[IMPORT_ACHATS_ERROR]', error)
        return NextResponse.json({ error: error.message || "Erreur lors de l'importation" }, { status: 500 })
    }
}
