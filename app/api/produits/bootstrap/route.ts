import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { processImportRows, type ImportRow } from '@/lib/importProduits'
import { resolveDataFilePath } from '@/lib/resolveDataFile'

const JSON_FILE = 'GestiCom_Produits_Master.json'

/**
 * En un seul appel : importe le catalogue depuis GestiCom_Produits_Master.json
 * (data/) puis initialise toutes les lignes Stock
 * (produit × magasin) à 0. À utiliser lorsque la base est vide ou réinitialisée.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const filePath = await resolveDataFilePath(JSON_FILE)
    if (!filePath) {
      return NextResponse.json(
        { error: `Fichier ${JSON_FILE} introuvable. Placez-le dans data/ (à la racine ou au niveau parent).` },
        { status: 404 }
      )
    }

    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as ImportRow[]
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Format JSON invalide (tableau attendu).' }, { status: 400 })
    }

    const magasinList = await prisma.magasin.findMany({
      where: { actif: true },
      select: { id: true, code: true },
    })
    const magasinByCode = new Map(magasinList.map((m) => [m.code.trim().toUpperCase(), m.id]))

    const importResult = await processImportRows(data, magasinByCode, prisma)

    const [produits, magasins] = await Promise.all([
      prisma.produit.findMany({ where: { actif: true }, select: { id: true } }),
      prisma.magasin.findMany({ where: { actif: true }, select: { id: true } }),
    ])

    // RÈGLE MÉTIER : Un produit = UN SEUL magasin
    // Pour chaque produit, créer un stock uniquement s'il n'en a pas déjà un
    let stockCreated = 0
    const premierMagasinId = magasins.length > 0 ? magasins[0].id : null
    
    if (!premierMagasinId) {
      return NextResponse.json({ error: 'Aucun magasin disponible.' }, { status: 400 })
    }

    for (const p of produits) {
      // Vérifier si le produit a déjà un stock (peu importe le magasin)
      const stockExistant = await prisma.stock.findFirst({
        where: { produitId: p.id }
      })
      
      if (!stockExistant) {
        // Le produit n'a pas de stock, créer un stock dans le premier magasin
        await prisma.stock.create({
          data: { produitId: p.id, magasinId: premierMagasinId, quantite: 0, quantiteInitiale: 0 },
        })
        stockCreated++
      }
    }

    return NextResponse.json({
      import: importResult,
      stockInit: { created: stockCreated },
    })
  } catch (e) {
    console.error('POST /api/produits/bootstrap:', e)
    const err = e as NodeJS.ErrnoException
    if (err?.code === 'ENOENT') {
      return NextResponse.json(
        { error: `Fichier ${JSON_FILE} introuvable.` },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors du bootstrap." },
      { status: 500 }
    )
  }
}
