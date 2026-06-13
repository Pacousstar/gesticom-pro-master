import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'

export const dynamic = 'force-dynamic'

const UPDATE_URL = process.env.UPDATE_URL || 'https://www.gsnexpertises.com/gesticom-update'
const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'

function parseVersion(v: string): number[] {
  return v.split('.').map(Number)
}

function isNewer(remote: string, current: string): boolean {
  const r = parseVersion(remote)
  const c = parseVersion(current)
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0
    const cv = c[i] || 0
    if (rv > cv) return true
    if (rv < cv) return false
  }
  return false
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession()
    const insufficient = requirePermission(session, 'parametres:view')
    if (insufficient) return insufficient

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${UPDATE_URL}/version.json`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json({
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        error: `Serveur de mise à jour injoignable (${response.status})`,
      })
    }

    const remote = await response.json()
    const remoteVersion = String(remote.version || '')
    const hasUpdate = isNewer(remoteVersion, CURRENT_VERSION)

    return NextResponse.json({
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      remoteVersion,
      downloadUrl: remote.downloadUrl || '',
      checksum: remote.checksum || '',
      changelog: remote.changelog || '',
      releaseDate: remote.releaseDate || '',
      required: remote.required === true,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        error: 'Délai de connexion dépassé',
      })
    }
    return NextResponse.json({
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: 'Impossible de vérifier les mises à jour',
    })
  }
}
