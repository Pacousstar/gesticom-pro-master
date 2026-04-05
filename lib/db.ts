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
// Si rien n'est défini, on tente une détection intelligente.
if (!process.env.DATABASE_URL) {
  // En production, on laisse le lanceur ou le service définir cette variable.
  // En dev, on peut avoir un fallback relatif si besoin, mais pas un chemin C: en dur qui écrase tout.
}

const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log(`[Prisma] Connexion à : ${dbUrl}`);
} else if (process.env.NODE_ENV === 'production') {
  console.error('[lib/db] ERREUR FATALE : DATABASE_URL non définie !');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'], 
  datasources: {
    db: {
      url: dbUrl, // On utilise uniquement dbUrl (pas de fallback en dur)
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
