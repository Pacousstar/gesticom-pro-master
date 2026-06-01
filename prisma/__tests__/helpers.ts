import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

let prisma: any = null
let dbPath: string | null = null

export async function createTestDatabase() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gesticom-test-'))
  dbPath = path.join(tmpDir, 'test.db')
  const schemaPath = path.join(__dirname, 'schema.test.prisma')
  const dbUrl = `file:${dbPath}`

  // Generate Prisma client with test schema
  execSync(`npx prisma generate --schema="${schemaPath}" --no-hints`, {
    stdio: 'pipe',
    env: { ...process.env }
  })

  // Push schema to test DB
  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: dbUrl }
  })

  // Create client pointing to test DB
  const { PrismaClient: TestPrismaClient } = require('@prisma/test-client')
  prisma = new TestPrismaClient({
    datasources: { db: { url: dbUrl } }
  })

  await prisma.$connect()
  return prisma
}

export async function destroyTestDatabase() {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
  if (dbPath) {
    try {
      const dir = path.dirname(dbPath)
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
    dbPath = null
  }
}

export function getDb() {
  if (!prisma) throw new Error('Test database not initialized. Call createTestDatabase() first.')
  return prisma
}
