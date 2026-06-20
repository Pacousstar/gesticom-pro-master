import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCookieName, getSession } from '@/lib/auth'
import { logDeconnexion, getIpAddress } from '@/lib/audit'
import { apiCatch } from '@/lib/log-error'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (session) {
      const ipAddress = getIpAddress(request)
      await logDeconnexion(session, ipAddress)
    }

    const c = await cookies()
    c.set(getCookieName(), '', { maxAge: 0, path: '/' })
    return NextResponse.redirect(new URL('/login', request.url).toString())
  } catch (e: unknown) {
    await apiCatch(e, 'api/auth/logout')
    const c = await cookies()
    c.set(getCookieName(), '', { maxAge: 0, path: '/' })
    return NextResponse.redirect(new URL('/login', request.url).toString())
  }
}
