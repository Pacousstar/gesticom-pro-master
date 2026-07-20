import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const filePath = join(process.cwd(), 'app', 'landing', 'page.html')
  let html = readFileSync(filePath, 'utf-8')

  // Remplacer les actions Formspree par l'API locale
  html = html.replace(
    /action="https:\/\/formspree\.io\/f\/[^"]+"/g,
    'action="/api/leads"'
  )

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
