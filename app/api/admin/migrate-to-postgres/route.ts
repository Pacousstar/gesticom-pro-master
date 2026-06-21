import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { isSQLite } from '@/lib/db-provider'
import { z } from 'zod'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const migrateSchema = z.object({
  postgresUrl: z.string().startsWith('postgresql://', 'L\'URL doit commencer par postgresql://'),
  password: z.string().min(8, 'Mot de passe minimum 8 caracteres'),
})

function sanitizeUrl(url: string): string {
  return url.replace(/\/\/.*@/, '//***:***@')
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, ['SUPER_ADMIN'])
  if (authError) return authError

  if (!isSQLite()) {
    return NextResponse.json(
      { error: 'La base de donnees est deja PostgreSQL.' },
      { status: 400 }
    )
  }

  try {
    const body = await req.json()
    const vres = validateApiRequest(migrateSchema, body)
    if (!vres.success) return vres.response
    const { postgresUrl, password } = vres.data

    const scriptPath = path.resolve(process.cwd(), 'scripts', 'migrate-sqlite-to-postgres.js')
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Script de migration introuvable.' },
        { status: 500 }
      )
    }

    const urlLog = sanitizeUrl(postgresUrl)
    console.log(`[migrate-to-postgres] Lancement migration vers ${urlLog}`)

    const child = spawn(process.execPath, [scriptPath, postgresUrl], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || '',
        DB_PASSWORD: password,
      },
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
      console.error(`[migrate-to-postgres] Echec (code ${exitCode}): ${stderr}`)
      return NextResponse.json({
        error: `La migration a echoue (code ${exitCode}).`,
        details: stderr || stdout.slice(-500),
      }, { status: 500 })
    }

    console.log(`[migrate-to-postgres] Succes`)

    return NextResponse.json({
      success: true,
      message: 'Migration reussie ! Redemarrez GestiCom Pro pour utiliser PostgreSQL.',
      log: stdout.split('\n').filter(Boolean).slice(-10),
    })
  } catch (e) {
    await apiCatch(e, 'api/admin/migrate-to-postgres')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
