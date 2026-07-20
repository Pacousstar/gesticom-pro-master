import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

const FORMSPREE_FORM_ID = 'mjgnrgby'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const apiKey = process.env.FORMSPREE_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'Clé API Formspree manquante. Ajoutez FORMSPREE_API_KEY dans le fichier .env.',
      help: 'Rendez-vous sur https://formspree.io/settings/api pour générer votre clé API.',
    }, { status: 400 })
  }

  try {
    const res = await fetch(`https://formspree.io/api/0/forms/${FORMSPREE_FORM_ID}/submissions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({
        error: `Erreur Formspree (${res.status})`,
        detail: errText,
      }, { status: 502 })
    }

    const data = await res.json()
    const submissions: any[] = data?.submissions || data?.entries || data || []
    const entiteId = await getEntiteId(session)

    let imported = 0
    let skipped = 0

    for (const sub of submissions) {
      const fields = sub.fields || sub.data || {}
      const nom = fields.nom || fields.name || sub.nom || sub.name
      if (!nom) { skipped++; continue }

      const email = fields.email || sub.email || null
      const contact = fields.contact || fields.telephone || fields.tel || sub.contact || null
      const domaine = fields.domaine || sub.domaine || null
      const message = fields.message || sub.message || null
      const source = fields.source === 'contact' ? 'contact' : 'preinscription'

      const existant = await prisma.lead.findFirst({
        where: { nom: String(nom), email: email ? String(email) : undefined },
      })
      if (existant) { skipped++; continue }

      await prisma.lead.create({
        data: {
          nom: String(nom).trim(),
          email: email ? String(email).trim() : null,
          contact: contact ? String(contact).trim() : null,
          domaine: domaine ? String(domaine).trim() : null,
          message: message ? String(message).trim() : null,
          source,
          entiteId,
        },
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, total: submissions.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur lors de l\'import.' }, { status: 500 })
  }
}
