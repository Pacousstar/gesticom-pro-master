import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const insufficient = requirePermission(session, 'parametres:edit')
    if (insufficient) return insufficient

    const { downloadUrl } = await request.json()
    if (!downloadUrl || typeof downloadUrl !== 'string') {
      return NextResponse.json(
        { error: 'URL de téléchargement manquante' },
        { status: 400 }
      )
    }

    const tempDir = path.join(process.env.TEMP || 'C:\\Temp', 'GestiCom-Update')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filename = `GestiCom-Pro-Setup-${Date.now()}.exe`
    const localPath = path.join(tempDir, filename)

    const response = await fetch(downloadUrl)
    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: `Échec du téléchargement (${response.status})` },
        { status: 502 }
      )
    }

    const nodeStream = Readable.fromWeb(response.body as any)
    const fileStream = fs.createWriteStream(localPath)
    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(fileStream)
      nodeStream.on('error', reject)
      fileStream.on('error', reject)
      fileStream.on('finish', resolve)
    })

    return NextResponse.json({
      success: true,
      localPath,
      filename,
      size: fs.statSync(localPath).size,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement de la mise à jour' },
      { status: 500 }
    )
  }
}
