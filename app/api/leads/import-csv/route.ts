import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

function findCol(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z]/g, '') === a.toLowerCase().replace(/[^a-z]/g, ''))
    if (idx !== -1) return idx
  }
  return -1
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
  const raw = await request.text()
  const lines = raw.split(/\r?\n/).filter(l => l.trim())

  if (lines.length < 2) {
    return NextResponse.json({ error: 'Le fichier CSV doit contenir un en-tête et au moins une ligne.' }, { status: 400 })
  }

  const headers = parseCSVLine(lines[0])
  const colNom = findCol(headers, ['nom', 'name', 'nom complet', 'full name'])
  const colEmail = findCol(headers, ['email', 'e-mail', 'courriel', 'mail'])
  const colContact = findCol(headers, ['contact', 'telephone', 'tel', 'phone', 'téléphone', 'mobile'])
  const colDomaine = findCol(headers, ['domaine', 'domaine d\'activité', 'secteur', 'activité', 'industry'])
  const colMessage = findCol(headers, ['message', 'commentaire', 'notes'])
  const colSource = findCol(headers, ['source', 'origin', 'type'])

  if (colNom === -1) {
    return NextResponse.json({
      error: 'Colonne "Nom" introuvable. Colonnes détectées : ' + headers.join(', '),
    }, { status: 400 })
  }

  let imported = 0
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const nom = cols[colNom] || ''
    if (!nom) { skipped++; continue }

    const email = colEmail !== -1 ? cols[colEmail] || null : null
    const contact = colContact !== -1 ? cols[colContact] || null : null
    const domaine = colDomaine !== -1 ? cols[colDomaine] || null : null
    const message = colMessage !== -1 ? cols[colMessage] || null : null
    const rawSource = colSource !== -1 ? (cols[colSource] || '').toLowerCase() : ''
    const source = rawSource.includes('contact') ? 'contact' : 'preinscription'

    const existant = await prisma.lead.findFirst({
      where: { nom, email: email || undefined },
    })
    if (existant) { skipped++; continue }

    await prisma.lead.create({
      data: { nom, email, contact, domaine, message, source, entiteId },
    })
    imported++
  }

  return NextResponse.json({ imported, skipped })
}
