import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  console.log('=== Réparation schéma ===')

  // 1. Lister tous les index
  const indexes: any = await p.$queryRawUnsafe(`
    SELECT name, tbl_name FROM "sqlite_master" WHERE type = 'index' AND sql IS NOT NULL
  `)
  console.log(`Index trouvés: ${indexes.length}`)

  // 2. Vérifier chaque table référencée
  const tables = new Set<string>()
  const tablesRaw: any = await p.$queryRawUnsafe(`SELECT name FROM "sqlite_master" WHERE type = 'table'`)
  for (const t of tablesRaw) tables.add(t.name)

  let dropped = 0
  for (const idx of indexes) {
    if (!tables.has(idx.tbl_name)) {
      console.log(`  Index orphelin: "${idx.name}" (table "${idx.tbl_name}" inexistante)`)
      try {
        await p.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.name}"`)
        dropped++
      } catch (e: any) {
        console.log(`  Erreur: ${e.message}`)
      }
    }
  }
  console.log(`${dropped} index(s) orphelin(s) supprimé(s)`)

  // 3. PRAGMA integrity_check
  const check: any = await p.$queryRawUnsafe('PRAGMA integrity_check')
  console.log(`Integrity check: ${JSON.stringify(check[0])}`)

  // 4. Stats stock
  const st: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock"')
  const pos: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0')
  console.log(`Stock: ${Number(st[0].c)} lignes, ${Number(pos[0].c)} positifs`)

  await p.$disconnect()
}

main().catch(console.error)
