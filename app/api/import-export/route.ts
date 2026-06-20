import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { validateImportData, prepareExportData } from '@/lib/import-export'
import { getEntiteId } from '@/lib/get-entite-id'

import { rowsToBuffer, makeResponse, parseExcel } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

/**
 * POST : Importer des données depuis Excel/CSV
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'parametres:import-export')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const entiteId = await getEntiteId(session!)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entity = formData.get('entity') as string

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 })
    }

    if (!entity) {
      return NextResponse.json({ error: 'Type d\'entité requis.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows: data } = await parseExcel(buffer)

    const validation = validateImportData(entity as any, data)
    
    if (validation.errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: validation.errors,
        message: `${validation.errors.length} erreur(s) détectée(s).`,
      }, { status: 400 })
    }

    // Importer les données validées
    let imported = 0
    let failed = 0
    const importErrors: Array<{ row: number; error: string }> = []

    for (const item of validation.valid) {
      try {
        switch (entity) {
          case 'PRODUITS':
            {
              const existing = await prisma.produit.findFirst({ where: { code: item.code, entiteId } })
              if (existing) {
                await prisma.produit.update({ where: { id: existing.id }, data: item })
              } else {
                await prisma.produit.create({ data: { ...item, actif: true, entiteId } })
              }
            }
            imported++
            break

          case 'CLIENTS': {
            const existingClient = await prisma.client.findFirst({
              where: { nom: item.nom, entiteId },
            })
            if (existingClient) {
              await prisma.client.update({
                where: { id: existingClient.id },
                data: item,
              })
            } else {
              await prisma.client.create({
                data: { ...item, actif: true, entiteId },
              })
            }
            imported++
            break
          }

          case 'FOURNISSEURS': {
            const existingFournisseur = await prisma.fournisseur.findFirst({
              where: { nom: item.nom, entiteId },
            })
            if (existingFournisseur) {
              await prisma.fournisseur.update({
                where: { id: existingFournisseur.id },
                data: item,
              })
            } else {
              await prisma.fournisseur.create({
                data: { ...item, actif: true, entiteId },
              })
            }
            imported++
            break
          }

          default:
            importErrors.push({ row: 0, error: `Type d'entité non supporté : ${entity}` })
        }
      } catch (error) {
        failed++
        importErrors.push({
          row: 0,
          error: error instanceof Error ? error.message : 'Erreur lors de l\'import',
        })
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      failed,
      errors: importErrors,
      message: `${imported} élément(s) importé(s) avec succès.`,
    })
  } catch (e) {
    await apiCatch(e, 'api/import-export')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

/**
 * GET : Exporter des données vers Excel/CSV
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'parametres:import-export')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const entiteId = await getEntiteId(session!)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const entity = request.nextUrl.searchParams.get('entity')
    const format = request.nextUrl.searchParams.get('format') || 'EXCEL'

    if (!entity) {
      return NextResponse.json({ error: 'Type d\'entité requis.' }, { status: 400 })
    }

    let data: any[] = []

    switch (entity) {
      case 'PRODUITS':
        data = await prisma.produit.findMany({
          where: { actif: true, entiteId },
          select: {
            code: true,
            designation: true,
            categorie: true,
            prixAchat: true,
            prixVente: true,
            seuilMin: true,
          },
        })
        break

      case 'CLIENTS':
        data = await prisma.client.findMany({
          where: { actif: true, entiteId },
          select: {
            nom: true,
            telephone: true,
            type: true,
            plafondCredit: true,
            ncc: true,
          },
        })
        break

      case 'FOURNISSEURS':
        data = await prisma.fournisseur.findMany({
          where: { actif: true, entiteId },
          select: {
            nom: true,
            telephone: true,
            email: true,
            ncc: true,
          },
        })
        break

      default:
        return NextResponse.json({ error: 'Type d\'entité non supporté.' }, { status: 400 })
    }

    const exportData = prepareExportData(entity as any, data)

    if (format === 'CSV') {
      const headers = exportData.length > 0 ? Object.keys(exportData[0]) : []
      const escapeCsv = (v: unknown) => {
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }
      const headerLine = headers.join(',') + '\n'
      const dataLines = exportData.map(row => headers.map(h => escapeCsv(row[h])).join(',')).join('\n')
      const buffer = Buffer.from(headerLine + dataLines, 'utf8')
      const filename = `export-${entity.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const buf = await rowsToBuffer(exportData, entity)
    const filename = `export-${entity.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
    return makeResponse(buf, filename)
  } catch (e) {
    await apiCatch(e, 'api/import-export')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
