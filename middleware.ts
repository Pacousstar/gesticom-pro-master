import { NextRequest, NextResponse } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 60

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (request.nextUrl.pathname === '/api/health') return response

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'anonymous'
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    } else if (entry.count >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 })
    } else {
      entry.count++
    }

    if (rateLimitMap.size > 10000) {
      const cutoff = now - RATE_LIMIT_WINDOW
      for (const [key, val] of rateLimitMap) {
        if (now > val.resetAt) rateLimitMap.delete(key)
      }
    }
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: '/api/:path*',
}
