import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { nom, email, sujet, message } = await req.json()

    if (!nom || !email || !message) {
      return NextResponse.json({ error: 'Nom, email et message sont requis.' }, { status: 400 })
    }

    const params = await prisma.parametre.findFirst()

    if (params?.smtpHost && params?.smtpUser && params?.smtpPass) {
      const transporter = nodemailer.createTransport({
        host: params.smtpHost,
        port: params.smtpPort || 587,
        secure: params.smtpPort === 465,
        auth: { user: params.smtpUser, pass: params.smtpPass },
      })
      await transporter.sendMail({
        from: `"${nom}" <${params.smtpUser}>`,
        to: 'pacous2000@gmail.com',
        subject: sujet ? `[Contact GestiCom] ${sujet}` : '[Contact GestiCom] Nouveau message',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
            <h2 style="color:#FF6B35;margin-bottom:16px">Nouveau message de contact</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Nom</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${nom}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Email</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${email}</td></tr>
              ${sujet ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Sujet</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${sujet}</td></tr>` : ''}
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;white-space:pre-wrap">${message}</div>
          </div>
        `,
      })
    } else {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER || 'pacous2000@gmail.com',
          pass: process.env.SMTP_PASS,
        },
      })
      await transporter.sendMail({
        from: `"${nom}" <${process.env.SMTP_USER || 'pacous2000@gmail.com'}>`,
        to: 'pacous2000@gmail.com',
        subject: sujet ? `[Contact GestiCom] ${sujet}` : '[Contact GestiCom] Nouveau message',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
            <h2 style="color:#FF6B35;margin-bottom:16px">Nouveau message de contact</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Nom</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${nom}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Email</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${email}</td></tr>
              ${sujet ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6">Sujet</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${sujet}</td></tr>` : ''}
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;white-space:pre-wrap">${message}</div>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, message: 'Message envoyé avec succès.' })
  } catch (err: any) {
    console.error('Erreur envoi contact:', err)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du message.' + (err.message ? ' (' + err.message + ')' : '') }, { status: 500 })
  }
}
