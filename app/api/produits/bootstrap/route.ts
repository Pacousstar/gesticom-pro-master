import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { processImportRows, type ImportRow } from '@/lib/importProduits'
import { resolveDataFilePath } from '@/lib/resolveDataFile'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

const JSON_FILE = 'GestiCom_Produits_Master.json'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:create')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

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

    const defaultMagasin = await prisma.magasin.findFirst({
      where: { actif: true, entiteId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true },
    })

    if (!defaultMagasin) {
      return NextResponse.json({ error: 'Aucun point de vente disponible dans votre entité.' }, { status: 400 })
    }

    const magasinByCode = new Map([[defaultMagasin.code.trim().toUpperCase(), defaultMagasin.id]])

    const importResult = await processImportRows(data, magasinByCode, prisma, entiteId)

    const produits = await prisma.produit.findMany({
      where: { actif: true, entiteId },
      select: { id: true },
    })

    let stockCreated = 0

    for (const p of produits) {
      const stockExistant = await prisma.stock.findFirst({
        where: { produitId: p.id, entiteId }
      })

      if (!stockExistant) {
        await prisma.stock.create({
          data: {
            produitId: p.id,
            magasinId: defaultMagasin.id,
            quantite: 0,
            quantiteInitiale: 0,
            entiteId,
          },
        })
        stockCreated++
      }
    }

    return NextResponse.json({
      import: importResult,
      stockInit: { created: stockCreated },
    })
  } catch (e) {
    await apiCatch(e, 'api/produits/bootstrap')
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