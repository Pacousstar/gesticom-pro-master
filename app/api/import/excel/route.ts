import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseExcel } from '@/lib/excel'
import { requireRole } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (forbidden) return forbidden

  try {
    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

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
    const { rows: data } = await parseExcel(buffer)

    // Normaliser les clés : ôter accents, lowercase, remplacer espaces par _
    const normalizeKey = (k: string) => {
      const map: Record<string, string> = {
        'designation': 'designation', 'désignation': 'designation', 'libellé': 'designation', 'libelle': 'designation', 'nom': 'designation', 'produit': 'designation', 'article': 'designation', 'description': 'designation',
        'prix_achat': 'prix_achat', 'prix achat': 'prix_achat', 'prixachat': 'prix_achat', 'coût': 'prix_achat', 'cout': 'prix_achat',
        'prix_vente': 'prix_vente', 'prix vente': 'prix_vente', 'prixvente': 'prix_vente',
        'categorie': 'categorie', 'catégorie': 'categorie', 'category': 'categorie',
        'seuil_min': 'seuil_min', 'seuil min': 'seuil_min', 'seuilmin': 'seuil_min', 'stock min': 'seuil_min'
      }
      const clean = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '_').trim()
      return map[clean] || clean
    }
    const normalized = data.map((row: any) => {
      const r: any = {}
      Object.keys(row).forEach(k => r[normalizeKey(k)] = row[k])
      return r
    })

    if (normalized.length === 0) {
      return NextResponse.json({ error: 'Fichier Excel vide.' }, { status: 400 })
    }

    let result: { created: number; updated: number; errors: string[] } = { created: 0, updated: 0, errors: [] }

    if (type === 'produits') {
      const magasinList = await prisma.magasin.findMany({
        where: { actif: true, entiteId },
        select: { id: true, code: true },
      })
      const magasinByCode = new Map(magasinList.map((m) => [m.code.trim().toUpperCase(), m.id]))

      for (const row of normalized) {
        try {
          const code = String(row?.code || '').trim().toUpperCase()
          const designation = String(row?.designation || '').trim()
          if (!code || !designation) {
            result.errors.push(`Ligne ignorée: Code ou Désignation manquant`)
            continue
          }

          const prixAchat = row?.prix_achat != null ? Number(row.prix_achat) : null
          const prixVente = row?.prix_vente != null ? Number(row.prix_vente) : null
          const categorie = String(row?.categorie || 'DIVERS').trim() || 'DIVERS'
          const seuilMin = Math.max(0, Number(row?.seuil_min) || 5)

          const existing = await prisma.produit.findFirst({ where: { code, entiteId } })
          if (existing) {
            await prisma.produit.update({
              where: { id: existing.id },
              data: { designation, categorie, prixAchat, prixVente, seuilMin },
            })
            result.updated++
          } else {
            await prisma.produit.create({
              data: { code, designation, categorie, prixAchat, prixVente, seuilMin, actif: true, entiteId },
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
            where: { nom, entiteId },
          })

          if (existing) {
            await prisma.client.update({
              where: { id: existing.id },
              data: { telephone, type, plafondCredit, actif: true },
            })
            result.updated++
          } else {
            await prisma.client.create({
              data: { nom, telephone, type, plafondCredit, actif: true, entiteId },
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
            where: { nom, entiteId },
          })

          if (existing) {
            await prisma.fournisseur.update({
              where: { id: existing.id },
              data: { telephone, email, actif: true },
            })
            result.updated++
          } else {
            await prisma.fournisseur.create({
              data: { nom, telephone, email, actif: true, entiteId },
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
