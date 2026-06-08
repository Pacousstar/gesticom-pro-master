import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  try {
    // Supprimer l'index orphelin
    await p.$executeRawUnsafe('DROP INDEX IF EXISTS "ArchiveVente_date_idx"')
    console.log('Index orphelin supprimé')

    const r: any = await p.$queryRawUnsafe('PRAGMA integrity_check')
    console.log('Intégrité:', JSON.stringify(r[0]))

    const r2: any = await p.$queryRawUnsafe('PRAGMA quick_check')
    console.log('Quick check:', JSON.stringify(r2))

    const st: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock"')
    console.log('Lignes stock:', Number(st[0].c))

    const pos: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0')
    console.log('Stock > 0:', Number(pos[0].c))
  } catch (e: any) {
    console.error('ERREUR:', e.message)
  }
  await p.$disconnect()
}

main()
