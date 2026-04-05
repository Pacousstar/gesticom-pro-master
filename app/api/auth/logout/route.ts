import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCookieName, getSession, verifyToken } from '@/lib/auth'
import { logDeconnexion, getIpAddress } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    // Logger la déconnexion si une session existe
    if (session) {
      const ipAddress = getIpAddress(request)
      await logDeconnexion(session, ipAddress)
    }

    // Supprimer le cookie
    const c = await cookies()
    c.delete(getCookieName())

    // Rediriger vers la page de login
    return NextResponse.redirect(new URL('/login', request.url))
  } catch (e: unknown) {
    console.error('Logout error:', e)
    // Supprimer le cookie même en cas d'erreur
    const c = await cookies()
    c.delete(getCookieName())
    // Rediriger vers la page de login même en cas d'erreur
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
