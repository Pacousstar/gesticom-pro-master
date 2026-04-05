import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { validateImportData, prepareExportData } from '@/lib/import-export'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

/**
 * POST : Importer des données depuis Excel/CSV
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
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
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

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
            await prisma.produit.upsert({
              where: { code: item.code },
              update: item,
              create: { ...item, actif: true },
            })
            imported++
            break

          case 'CLIENTS':
            const existingClient = await prisma.client.findFirst({
              where: { nom: item.nom },
            })
            if (existingClient) {
              await prisma.client.update({
                where: { id: existingClient.id },
                data: item,
              })
            } else {
              await prisma.client.create({
                data: { ...item, actif: true },
              })
            }
            imported++
            break

          case 'FOURNISSEURS':
            const existingFournisseur = await prisma.fournisseur.findFirst({
              where: { nom: item.nom },
            })
            if (existingFournisseur) {
              await prisma.fournisseur.update({
                where: { id: existingFournisseur.id },
                data: item,
              })
            } else {
              await prisma.fournisseur.create({
                data: { ...item, actif: true },
              })
            }
            imported++
            break

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
    console.error('POST /api/import-export:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

/**
 * GET : Exporter des données vers Excel/CSV
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const entity = request.nextUrl.searchParams.get('entity')
    const format = request.nextUrl.searchParams.get('format') || 'EXCEL'

    if (!entity) {
      return NextResponse.json({ error: 'Type d\'entité requis.' }, { status: 400 })
    }

    let data: any[] = []

    switch (entity) {
      case 'PRODUITS':
        data = await prisma.produit.findMany({
          where: { actif: true },
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
          where: { actif: true },
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
          where: { actif: true },
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
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, entity)

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: format === 'CSV' ? 'csv' : 'xlsx' })

    const filename = `export-${entity.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format === 'CSV' ? 'csv' : 'xlsx'}`
    const contentType = format === 'CSV' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('GET /api/import-export:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
