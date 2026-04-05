import type { PrismaClient } from '@prisma/client'

export type ImportRow = {
  code?: string
  designation?: string
  categorie?: string
  prix_achat?: number | null
  prix_vente?: number | null
  seuil_min?: number
  magasins?: string[]
  stock_initial?: number
}

export type ImportResult = { created: number; updated: number; stocksCreated: number }

/** Traite un tableau de lignes : crée/met à jour les Produits et les Stocks (produit×magasin) si magasins est fourni. */
export async function processImportRows(
  rows: ImportRow[],
  magasinByCode: Map<string, number>,
  prisma: PrismaClient
): Promise<ImportResult> {
  let created = 0
  let updated = 0
  let stocksCreated = 0

  for (const row of rows) {
    const code = String(row?.code || '').trim().toUpperCase()
    const designation = String(row?.designation || '').trim()
    if (!code || !designation) continue

    const prixAchat = row?.prix_achat != null ? Number(row.prix_achat) : null
    const prixVente = row?.prix_vente != null ? Number(row.prix_vente) : null
    const categorie = String(row?.categorie || 'DIVERS').trim() || 'DIVERS'
    const seuilMin = Math.max(0, Number(row?.seuil_min) || 5)

    let produitId: number
    const existing = await prisma.produit.findUnique({ where: { code } })
    if (existing) {
      await prisma.produit.update({
        where: { id: existing.id },
        data: { designation, categorie, prixAchat, prixVente, seuilMin },
      })
      produitId = existing.id
      updated++
    } else {
      const p = await prisma.produit.create({
        data: { code, designation, categorie, prixAchat, prixVente, seuilMin, actif: true },
      })
      produitId = p.id
      created++
    }

    // RÈGLE MÉTIER : Un produit = UN SEUL magasin
    // Prendre le premier magasin de la liste (ou aucun si la liste est vide)
    const magasins = Array.isArray(row.magasins) ? row.magasins : []
    const premierMagasinCode = magasins.length > 0 ? String(magasins[0] || '').trim().toUpperCase() : null
    
    if (premierMagasinCode) {
      const magasinId = magasinByCode.get(premierMagasinCode)
      if (magasinId != null) {
        // Vérifier si le produit a déjà un stock (peu importe le magasin)
        const stockExistant = await prisma.stock.findFirst({
          where: { produitId }
        })
        
        if (!stockExistant) {
          // Le produit n'a pas de stock, créer un stock dans le premier magasin de la liste
          const qteInit =
            typeof row.stock_initial === 'number' && row.stock_initial >= 0
              ? Math.floor(row.stock_initial)
              : 0
          
          await prisma.stock.create({
            data: {
              produitId,
              magasinId,
              quantite: qteInit,
              quantiteInitiale: qteInit,
            },
          })
          stocksCreated++
        }
      }
    }
  }

  return { created, updated, stocksCreated }
}
