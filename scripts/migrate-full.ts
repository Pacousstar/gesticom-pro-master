import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'
const p = new PrismaClient()

async function main() {
  console.log('=== Migration COMPLÈTE du schéma ===\n')

  // Lire le schema.prisma pour extraire tous les modèles et leurs colonnes
  const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

  // Extraire les modèles avec leurs champs
  const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g
  const models: { name: string; fields: { name: string; type: string; attrs: string[] }[] }[] = []
  let m: RegExpExecArray | null
  while ((m = modelRegex.exec(schema)) !== null) {
    const name = m[1]
    const body = m[2]
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('@@') && !l.startsWith('//'))
    const fields = lines.map(l => {
      const parts = l.split(/\s+/)
      const fname = parts[0]
      const ftype = parts[1]
      const attrs = parts.slice(2).filter(a => a.startsWith('@'))
      return { name: fname, type: ftype, attrs }
    })
    models.push({ name, fields })
  }

  // Récupérer les tables et colonnes existantes dans la base
  const tables = await p.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name', 'table')
  const existingTables = new Set(tables.map((t: any) => t.name))

  // Pour chaque table existante, récupérer ses colonnes
  const existingColumns = new Map<string, Set<string>>()
  for (const t of tables) {
    const cols = await p.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${(t as any).name}")`)
    existingColumns.set((t as any).name, new Set(cols.map((c: any) => c.name)))
  }

  // Appliquer les ALTER TABLE pour les colonnes manquantes
  let alters = 0
  let creates = 0
  for (const model of models) {
    if (!existingTables.has(model.name)) {
      // Table manquante — on va la créer
      console.log(`  [MANQUANTE] Table ${model.name}`)
      // On ne peut pas créer de table ici avec $executeRawUnsafe pour un CREATE TABLE complexe
      // On va le faire avec un raw SQL
      creates++
    } else {
      const existing = existingColumns.get(model.name)!
      for (const field of model.fields) {
        if (field.name === 'id') continue
        if (field.name.startsWith('@@')) continue
        if (!existing.has(field.name)) {
          const sqlType = mapType(field.type)
          const nullable = field.attrs.some(a => a.includes('@default')) ? '' : ''
          const def = getDefault(field.attrs, field.type)
          try {
            const sql = `ALTER TABLE "${model.name}" ADD COLUMN "${field.name}" ${sqlType}${def ? ' DEFAULT ' + def : ''};`
            await p.$executeRawUnsafe(sql)
            console.log(`  + ${model.name}.${field.name} (${sqlType}${def ? ', default=' + def : ''})`)
            alters++
          } catch (e: any) {
            console.log(`  - ${model.name}.${field.name} : ${e.message?.substring(0, 80)}`)
          }
        }
      }
    }
  }

  console.log(`\nColonnes ajoutées : ${alters}`)
  if (creates > 0) console.log(`Tables manquantes : ${creates} (à créer manuellement)`)

  // Vérifier les colonnes spécifiques rapportées dans les logs
  const checks = ['estVenteRapide', 'dateCloture', 'dateOperation', 'entiteId']
  for (const col of checks) {
    for (const t of tables) {
      const tn = (t as any).name
      const cols = await p.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${tn}")`)
      if (cols.some((c: any) => c.name === col)) {
        console.log(`  ✅ ${tn}.${col} présent`)
      }
    }
  }

  await p.$disconnect()
}

function mapType(prisma: string): string {
  const map: Record<string, string> = {
    Int: 'INTEGER',
    Float: 'REAL',
    String: 'TEXT',
    Boolean: 'INTEGER',
    DateTime: 'TEXT',
    BigInt: 'INTEGER',
    Decimal: 'REAL',
    Json: 'TEXT',
    Bytes: 'BLOB',
  }
  return map[prisma] || 'TEXT'
}

function getDefault(attrs: string[], type: string): string | null {
  for (const a of attrs) {
    if (a.includes('@default')) {
      const m = a.match(/@default\(([^)]+)\)/)
      if (!m) return null
      const val = m[1]
      if (val === 'autoincrement()' || val === 'cuid()' || val === 'uuid()' || val === 'now()') return null
      if (val === 'true') return '1'
      if (val === 'false') return '0'
      // For string defaults
      if (type === 'String') return `'${val}'`
      return val
    }
  }
  return null
}

main().catch(console.error)
