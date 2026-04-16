import nodemailer from 'nodemailer'
import { prisma } from './db'

export async function sendRelanceEmail({ to, subject, text, buffer, filename }: { 
  to: string, 
  subject: string, 
  text: string, 
  buffer?: Buffer,
  filename?: string 
}) {
  const params = await prisma.parametre.findFirst()
  
  if (!params?.smtpHost || !params?.smtpUser || !params?.smtpPass) {
    throw new Error('SMTP non configuré dans les paramètres du logiciel.')
  }

  const transporter = nodemailer.createTransport({
    host: params.smtpHost,
    port: params.smtpPort || 587,
    secure: params.smtpPort === 465,
    auth: {
      user: params.smtpUser,
      pass: params.smtpPass,
    },
  })

  const mailOptions: any = {
    from: `"${params.nomEntreprise || 'GestiCom Pro'}" <${params.smtpUser}>`,
    to,
    subject,
    text,
  }

  if (buffer && filename) {
    mailOptions.attachments = [
      {
        filename,
        content: buffer,
      },
    ]
  }

  return await transporter.sendMail(mailOptions)
}
