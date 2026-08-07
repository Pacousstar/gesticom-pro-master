import path from 'path'
import fs from 'fs'
import type { PrismaClient as PrismaClientType } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined
}

function resolveDbUrl(): string {
  const envUrl = process.env.DATABASE_URL || ''
  const trimmed = envUrl.trim()

  if (trimmed && !trimmed.startsWith('file:./') && !trimmed.startsWith('file:.\\')) {
    return trimmed
  }

  const configDirs = [
    process.env.GESTICOM_USER_DATA,
    ...(process.env.APPDATA ? [path.join(process.env.APPDATA, 'gesticom-pro')] : []),
    process.cwd(),
  ].filter(Boolean) as string[]

  for (const dir of configDirs) {
    const configPath = path.join(dir, 'config.json')
    if (fs.existsSync(configPath)) {
      const dbPath = path.join(dir, 'gesticom.db').replace(/\\/g, '/')
      return `file:${dbPath}`
    }
  }

  const dbPath = path.join(process.cwd(), 'gesticom.db').replace(/\\/g, '/')
  return `file:${dbPath}`
}

if (process.env.NODE_ENV !== 'production' && process.platform === 'win32') {
  const usePortableDb = process.env.GESTICOM_USE_PORTABLE_DB === '1'
  const prodPath = path.join('C:', 'GestiCom-Portable', 'database_url.txt')
  if (usePortableDb && fs.existsSync(prodPath)) {
    try {
      const url = fs.readFileSync(prodPath, 'utf8').trim()
      if (url) process.env.DATABASE_URL = url
    } catch {}
  }
}

function normalizeUrl(raw: string): string {
  if (!raw.startsWith('file:')) return raw
  return 'file:' + raw.replace('file:', '').replace(/\\/g, '/')
}

function loadPrismaClient(url: string) {
  if (url.startsWith('postgresql://')) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).__GESTICOM_PG_CLIENT) {
      return (globalThis as any).__GESTICOM_PG_CLIENT
    }
    throw new Error('Client PostgreSQL non disponible dans cette installation')
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).__GESTICOM_SQLITE_CLIENT) {
    return (globalThis as any).__GESTICOM_SQLITE_CLIENT
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[lib/db] Aucun client Prisma global, fallback require(@prisma/client)')
  }
  return require('@prisma/client').PrismaClient
}

function getOrCreatePrisma(): PrismaClientType {
  const url = normalizeUrl(resolveDbUrl())

  if (!url) {
    if (process.env.NODE_ENV === 'production') console.error('[lib/db] ERREUR FATALE : DATABASE_URL non définie !')
    throw new Error('DATABASE_URL non définie')
  }

  const existing = globalForPrisma.prisma
  if (existing && (existing as any).__dbUrl === url) return existing
  if (existing) { (existing as any).$disconnect(); delete globalForPrisma.prisma }

  const PrismaClientClass = loadPrismaClient(url)
  const client = new PrismaClientClass({ log: ['error'], datasources: { db: { url } } }) as PrismaClientType
  ;(client as any).__dbUrl = url
  globalForPrisma.prisma = client
  return client
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_, prop: string | symbol) {
    return (getOrCreatePrisma() as any)[prop]
  },
})
