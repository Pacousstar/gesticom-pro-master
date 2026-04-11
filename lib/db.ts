import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// En développement : si GESTICOM_USE_PORTABLE_DB=1 ou fichier C:\GestiCom-Portable présent, utiliser la même base que le portable.
if (process.env.NODE_ENV !== 'production' && process.platform === 'win32') {
  const usePortableDb = process.env.GESTICOM_USE_PORTABLE_DB === '1'
  const prodPath = path.join('C:', 'GestiCom-Portable', 'database_url.txt')
  if (usePortableDb && fs.existsSync(prodPath)) {
    try {
      const url = fs.readFileSync(prodPath, 'utf8').trim()
      if (url) process.env.DATABASE_URL = url
    } catch (_) { }
  }
}
// On utilise la DATABASE_URL du .env en priorité absolue.
const dbUrlRaw = process.env.DATABASE_URL || '';
let dbUrl = dbUrlRaw;

// Correction Windows : Remplacer backslashes par slashes pour Prisma et s'assurer du prefixe file:
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '');
  dbUrl = `file:${filePath.replace(/\\/g, '/')}`;
}

if (dbUrl && process.env.NEXT_PHASE !== 'phase-production-build') {
  console.log(`[Prisma] Connexion active : ${dbUrl}`);
} else if (process.env.NODE_ENV === 'production' && !dbUrl) {
  console.error('[lib/db] ERREUR FATALE : DATABASE_URL non définie !');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'], 
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
