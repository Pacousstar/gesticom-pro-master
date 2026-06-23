import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const BACKUP_DIR_NAME = 'backups'

function resolveBackupDir(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  if (dbUrl.startsWith('postgresql')) {
    const backupDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'database', 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    return backupDir
  }
  let filePath = dbUrl
  if (filePath.startsWith('file:')) filePath = filePath.slice(5)
  try { filePath = decodeURIComponent(filePath) } catch {}
  const dbDir = path.dirname(path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath))
  const backupDir = path.join(/*turbopackIgnore: true*/ dbDir, BACKUP_DIR_NAME)
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

function listBackups(): { name: string; size: number; date: string }[] {
  const dir = resolveBackupDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir)
  const result: { name: string; size: number; date: string }[] = []
  for (const name of files) {
    const fullPath = path.join(/*turbopackIgnore: true*/ dir, name)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isFile()) {
        result.push({ name, size: stat.size, date: stat.mtime.toISOString() })
      }
    } catch {}
  }
  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return result
}

export async function GET() {
  const session = await getSession()
  const authError = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (authError) return authError

  try {
    const backups = listBackups()
    return NextResponse.json({ success: true, backups, backupDir: resolveBackupDir() })
  } catch (e) {
    await apiCatch(e, 'api/admin/backup')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST() {
  const session = await getSession()
  const authError = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (authError) return authError

  try {
    const scriptPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'scripts', 'sauvegarde-bd.js')
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Script de sauvegarde introuvable.' }, { status: 500 })
    }

    const child = spawn(process.execPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: /*turbopackIgnore: true*/ process.cwd(),
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || '' },
      shell: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', resolve)
      child.on('error', () => resolve(-1))
    })

    if (exitCode !== 0) {
      return NextResponse.json({
        error: 'Sauvegarde echouee.',
        details: stderr || stdout.slice(-300),
      }, { status: 500 })
    }

    const backups = listBackups()
    const latest = backups[0] || null

    return NextResponse.json({
      success: true,
      message: stdout.trim(),
      latest,
      totalBackups: backups.length,
    })
  } catch (e) {
    await apiCatch(e, 'api/admin/backup')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
