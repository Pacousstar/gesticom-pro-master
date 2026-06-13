import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 10
const rateMap = new Map<string, { count: number; resetAt: number }>()

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting on login
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const entry = rateMap.get(ip)

    if (entry && now < entry.resetAt) {
      entry.count++
      if (entry.count > RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans une minute.' },
          { status: 429 }
        )
      }
    } else {
      rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/login'],
}
