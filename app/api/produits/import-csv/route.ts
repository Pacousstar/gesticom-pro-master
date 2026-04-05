import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { processImportRows, type ImportRow } from '@/lib/importProduits'
import { resolveDataFilePath } from '@/lib/resolveDataFile'

const CSV_FILE = 'GestiCom_Produits_Master.csv'

/** Parse une ligne CSV simple (virgules). Si Designation contient des virgules, on reconstitue. */
function parseCsvLine(line: string): string[] {
  const parts: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1
      while (end < line.length) {
        const j = line.indexOf('"', end)
        if (j === -1) break
        if (line[j + 1] === '"') { end = j + 2; continue }
        end = j
        break
      }
      parts.push(line.slice(i + 1, end).replace(/""/g, '"').trim())
      i = end + 1
      if (line[i] === ',') i++
      continue
    }
    const j = line.indexOf(',', i)
    if (j === -1) {
      parts.push(line.slice(i).trim())
      break
    }
    parts.push(line.slice(i, j).trim())
    i = j + 1
  }
  return parts
}

/** Colonnes attendues : ID, Code, Designation, Categorie, Prix_Achat, Prix_Vente, Stock_Initial, Seuil_Min. Si Designation contient des virgules, les colonnes 2..n-5 sont fusionnées. */
function csvRowsToImportRows(lines: string[]): ImportRow[] {
  const rows: ImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i])
    if (parts.length < 8) continue
    const code = parts[1]?.trim()
    const designation = parts.slice(2, parts.length - 5).join(',').trim()
    if (!code || !designation) continue
    const idx = parts.length - 5
    const pa = parts[idx + 1]?.trim()
    const pv = parts[idx + 2]?.trim()
    const si = parts[idx + 3]?.trim()
    const sm = parts[idx + 4]?.trim()
    rows.push({
      code,
      designation,
      categorie: parts[idx]?.trim() || 'DIVERS',
      prix_achat: pa && pa !== '' ? Number(pa) : null,
      prix_vente: pv && pv !== '' ? Number(pv) : null,
      seuil_min: sm !== '' && sm != null ? Math.max(0, Number(sm) || 5) : 5,
      stock_initial: si !== '' && si != null ? Math.max(0, Number(si) || 0) : undefined,
    })
  }
  return rows
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const filePath = await resolveDataFilePath(CSV_FILE)
    if (!filePath) {
      return NextResponse.json(
        { error: `Fichier ${CSV_FILE} introuvable. Placez-le dans data/.` },
        { status: 404 }
      )
    }
    const raw = await readFile(filePath, 'utf-8')
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Fichier CSV vide ou sans lignes de données.' }, { status: 400 })
    }

    const data = csvRowsToImportRows(lines)
    if (data.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne valide (Code, Désignation requis).' }, { status: 400 })
    }

    const magasinList = await prisma.magasin.findMany({
      where: { actif: true },
      select: { id: true, code: true },
    })
    const magasinByCode = new Map(magasinList.map((m) => [m.code.trim().toUpperCase(), m.id]))

    const { created, updated, stocksCreated } = await processImportRows(data, magasinByCode, prisma)

    return NextResponse.json({ created, updated, total: data.length, stocksCreated })
  } catch (e) {
    console.error('POST /api/produits/import-csv:', e)
    const err = e as NodeJS.ErrnoException
    if (err?.code === 'ENOENT') {
      return NextResponse.json(
        { error: `Fichier ${CSV_FILE} introuvable dans data/.` },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de l'import CSV." },
      { status: 500 }
    )
  }
}
