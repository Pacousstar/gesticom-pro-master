import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const emailFactureSchema = z.object({
  emailDestinataire: z.string().email('Email invalide.').max(200).trim(),
  htmlContent: z.string().min(1, 'Contenu requis.').max(50000),
  subject: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const validation = validateApiRequest(emailFactureSchema, body)
    if (!validation.success) return validation.response
    const { emailDestinataire, htmlContent, subject } = validation.data

    // Récupérer la conf SMTP courante
    const parametre = await prisma.parametre.findFirst()
    if (!parametre || !parametre.smtpHost || !parametre.smtpUser || !parametre.smtpPass) {
      return NextResponse.json({ error: 'Configuration SMTP manquante dans les paramètres.' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: parametre.smtpHost,
      port: parametre.smtpPort || 465,
      secure: parametre.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: parametre.smtpUser,
        pass: parametre.smtpPass,
      },
    })

    // L'email sera envoyé avec un style de document englobé
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
           <meta charset="utf-8">
        </head>
        <body style="background-color: #f3f4f6; padding: 20px; font-family: sans-serif;">
           <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <p>Bonjour,</p>
              <p>Veuillez trouver ci-dessous le détail de votre document <strong>${subject || 'Facture / Reçu'}</strong>.</p>
              <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
              
              <div style="font-family: monospace; font-size: 13px; color: #1f2937;">
                ${htmlContent}
              </div>

              <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #6b7280;">Cordialement,</p>
              <p style="font-size: 14px; font-weight: bold; margin-top: 5px;">${parametre.nomEntreprise || 'Notre Entreprise'}</p>
           </div>
        </body>
      </html>
    `

    await transporter.sendMail({
      from: `"${parametre.nomEntreprise || 'GestiCom'}" <${parametre.smtpUser}>`,
      to: emailDestinataire,
      subject: subject || 'Votre Facture / Reçu',
      html: styledHtml,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    await apiCatch(error, 'api/email/send-facture')
    return NextResponse.json({ error: error.message || "Erreur lors de l'envoi de l'email." }, { status: 500 })
  }
}
