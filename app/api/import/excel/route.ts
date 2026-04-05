import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx-prototype-pollution-fixed'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null // 'produits', 'clients', 'fournisseurs'

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 })
    }

    if (!type || !['produits', 'clients', 'fournisseurs'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide. Utilisez: produits, clients ou fournisseurs.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[]

    if (data.length === 0) {
      return NextResponse.json({ error: 'Fichier Excel vide.' }, { status: 400 })
    }

    let result: { created: number; updated: number; errors: string[] } = { created: 0, updated: 0, errors: [] }

    if (type === 'produits') {
      const magasinList = await prisma.magasin.findMany({
        where: { actif: true },
        select: { id: true, code: true },
      })
      const magasinByCode = new Map(magasinList.map((m) => [m.code.trim().toUpperCase(), m.id]))

      for (const row of data) {
        try {
          const code = String(row?.Code || row?.code || '').trim().toUpperCase()
          const designation = String(row?.Designation || row?.designation || '').trim()
          if (!code || !designation) {
            result.errors.push(`Ligne ignorée: Code ou Désignation manquant`)
            continue
          }

          const prixAchat = row?.PrixAchat != null || row?.prix_achat != null
            ? Number(row.PrixAchat || row.prix_achat)
            : null
          const prixVente = row?.PrixVente != null || row?.prix_vente != null
            ? Number(row.PrixVente || row.prix_vente)
            : null
          const categorie = String(row?.Categorie || row?.categorie || 'DIVERS').trim() || 'DIVERS'
          const seuilMin = Math.max(0, Number(row?.SeuilMin || row?.seuil_min) || 5)

          const existing = await prisma.produit.findUnique({ where: { code } })
          if (existing) {
            await prisma.produit.update({
              where: { id: existing.id },
              data: { designation, categorie, prixAchat, prixVente, seuilMin },
            })
            result.updated++
          } else {
            await prisma.produit.create({
              data: { code, designation, categorie, prixAchat, prixVente, seuilMin, actif: true },
            })
            result.created++
          }
        } catch (e) {
          result.errors.push(`Erreur ligne: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    } else if (type === 'clients') {
      for (const row of data) {
        try {
          const nom = String(row?.Nom || row?.nom || '').trim()
          if (!nom) {
            result.errors.push(`Ligne ignorée: Nom manquant`)
            continue
          }

          const telephone = row?.Telephone != null || row?.telephone != null
            ? String(row.Telephone || row.telephone).trim()
            : null
          const type = ['CREDIT', 'CASH'].includes(String(row?.Type || row?.type || 'CASH').toUpperCase())
            ? String(row.Type || row.type).toUpperCase()
            : 'CASH'
          const plafondCredit = row?.PlafondCredit != null || row?.plafond_credit != null
            ? Number(row.PlafondCredit || row.plafond_credit)
            : null

          // Vérifier si le client existe déjà (par nom) — SQLite : pas de mode insensitive
          const existing = await prisma.client.findFirst({
            where: { nom },
          })

          if (existing) {
            await prisma.client.update({
              where: { id: existing.id },
              data: { telephone, type, plafondCredit, actif: true },
            })
            result.updated++
          } else {
            await prisma.client.create({
              data: { nom, telephone, type, plafondCredit, actif: true },
            })
            result.created++
          }
        } catch (e) {
          result.errors.push(`Erreur ligne: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    } else if (type === 'fournisseurs') {
      for (const row of data) {
        try {
          const nom = String(row?.Nom || row?.nom || '').trim()
          if (!nom) {
            result.errors.push(`Ligne ignorée: Nom manquant`)
            continue
          }

          const telephone = row?.Telephone != null || row?.telephone != null
            ? String(row.Telephone || row.telephone).trim()
            : null
          const email = row?.Email != null || row?.email != null
            ? String(row.Email || row.email).trim()
            : null

          // Vérifier si le fournisseur existe déjà (par nom) — SQLite : pas de mode insensitive
          const existing = await prisma.fournisseur.findFirst({
            where: { nom },
          })

          if (existing) {
            await prisma.fournisseur.update({
              where: { id: existing.id },
              data: { telephone, email, actif: true },
            })
            result.updated++
          } else {
            await prisma.fournisseur.create({
              data: { nom, telephone, email, actif: true },
            })
            result.created++
          }
        } catch (e) {
          result.errors.push(`Erreur ligne: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      total: result.created + result.updated,
    })
  } catch (e) {
    console.error('POST /api/import/excel:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lors de l\'import Excel.' },
      { status: 500 }
    )
  }
}
