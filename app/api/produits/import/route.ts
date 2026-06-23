import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { parseExcel } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'
import { comptabiliserMouvementStock } from '@/lib/comptabilisation'

const CODE_PADDING = 3

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:create')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as Blob
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows: data } = await parseExcel(buffer)

    if (data.length === 0) return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })

    const defaultMagasin = await prisma.magasin.findFirst({
      where: { actif: true, entiteId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true },
    })

    if (!defaultMagasin) {
      return NextResponse.json({ error: 'Aucun point de vente disponible dans votre entité.' }, { status: 400 })
    }

    let created = 0
    let updated = 0

    for (const row of data) {
      const normalizeKey = (k: string) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '_').trim()
      const getVal = (keys: string[]) => {
        const foundKey = Object.keys(row).find(k => keys.includes(normalizeKey(k)))
        return foundKey ? row[foundKey] : null
      }

      const designation = getVal(['designation', 'nom', 'produit', 'article', 'description'])
      const code = getVal(['code', 'ref', 'reference', 'sku'])?.toString()
      const categorieName = getVal(['categorie', 'category', 'famille', 'groupe'])?.toString() || 'DIVERS'
      const prixAchat = Number(getVal(['prix achat', 'pa', 'prix_achat', 'achat'])) || 0
      const prixVente = Number(getVal(['prix vente', 'pv', 'prix_vente', 'vente'])) || 0
      const seuilMin = Number(getVal(['seuil min', 'seuil', 'alerte', 'min'])) || 5
      const stockInitial = getVal(['stock initial', 'stock', 'quantite', 'qte'])
      const codeBarres = getVal(['code barre', 'code_barres', 'ean', 'barcode'])?.toString()

      if (!designation || !code) continue

      const existing = await prisma.produit.findFirst({
        where: { code, entiteId }
      })

      let produitId: number

      if (existing) {
        if (!existing.actif) continue

        const dataUpdate: any = {
          designation: designation.toString(),
          categorie: categorieName,
          prixAchat,
          prixVente,
          seuilMin,
        }
        if (codeBarres && !existing.codeBarres) {
          const existsBarcode = await prisma.produit.findFirst({
            where: { codeBarres, entiteId, id: { not: existing.id } }
          })
          if (!existsBarcode) dataUpdate.codeBarres = codeBarres
        }

        const p = await prisma.produit.update({
          where: { id: existing.id },
          data: dataUpdate,
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
            entiteId,
            actif: true,
            pamp: prixAchat,
            codeBarres: codeBarres || null,
          },
        })
        produitId = p.id
        created++
      }

      if (stockInitial !== null && stockInitial !== undefined) {
        const qte = Math.max(0, Number(stockInitial) || 0)

        const existingStock = await prisma.stock.findFirst({
          where: { produitId, entiteId }
        })

        if (existingStock) {
          if (qte !== existingStock.quantite) {
            await prisma.stock.update({
              where: { id: existingStock.id },
              data: { quantite: qte }
            })
          }
        } else {
          await prisma.stock.create({
            data: {
              produitId,
              magasinId: defaultMagasin.id,
              quantite: qte,
              quantiteInitiale: qte,
              entiteId,
            }
          })

          if (qte > 0) {
            await prisma.mouvement.create({
              data: {
                type: 'ENTREE',
                produitId,
                magasinId: defaultMagasin.id,
                entiteId,
                utilisateurId: session.userId,
                quantite: qte,
                dateOperation: new Date(),
                observation: `Stock initial import Excel - ${defaultMagasin.code}`,
              }
            })

            const lastMvt = await prisma.mouvement.findFirst({
              where: { produitId, entiteId },
              orderBy: { id: 'desc' },
              select: { id: true }
            })
            if (lastMvt) {
              await comptabiliserMouvementStock({
                produitId,
                magasinId: defaultMagasin.id,
                type: 'ENTREE',
                quantite: qte,
                date: new Date(),
                motif: `Stock initial import Excel - ${defaultMagasin.code}`,
                utilisateurId: session.userId,
                entiteId,
                mouvementId: lastMvt.id
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, created, updated, total: data.length })
  } catch (error: any) {
    await apiCatch(error, 'api/produits/import')
    return NextResponse.json({ error: error.message || "Erreur lors de l'importation" }, { status: 500 })
  }
}