import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const clientId = Number(id)

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

    // 1. Récupérer toutes les factures (ventes) non soldées
    const facturesImpayees = await prisma.vente.findMany({
      where: { 
        clientId, 
        statut: 'VALIDEE',
        statutPaiement: { in: ['PARTIEL', 'CREDIT'] }
      },
      select: {
        id: true,
        numero: true,
        date: true,
        montantTotal: true,
        montantPaye: true,
      },
      orderBy: { date: 'asc' }
    })

    // 2. Calcul du solde réel par agrégation (méthode robuste)
    const ventesClient = await prisma.vente.findMany({ 
      where: { clientId, statut: 'VALIDEE' },
      select: { montantTotal: true, montantPaye: true }
    })
    
    const detteFactures = ventesClient.reduce((s, v) => s + (v.montantTotal - (v.montantPaye || 0)), 0)
    
    const regsLibres = await prisma.reglementVente.aggregate({
      where: { clientId, venteId: null, statut: 'VALIDE' },
      _sum: { montant: true }
    })
    
    const totalRegsLibres = regsLibres._sum?.montant || 0
    const soldeInitial = client.soldeInitial || 0
    const avoirInitial = client.avoirInitial || 0
    
    const soldeFinal = (detteFactures + soldeInitial) - (totalRegsLibres + avoirInitial)

    if (soldeFinal <= 0 && facturesImpayees.length === 0) {
      return NextResponse.json({ 
        message: `Le client ${client.nom} n'a aucune dette actuellement (Solde: ${soldeFinal} F).`,
        canRelance: false
      })
    }

    const message = `Bonjour ${client.nom}, c'est GestiCom Pro. Nous vous informons que votre solde débiteur actuel est de *${soldeFinal.toLocaleString()} FCFA*. Pourriez-vous passer régulariser votre situation ? Merci d'avance.`
    const phone = client.telephone ? client.telephone.replace(/\s+/g, '') : ''
    
    // URL WhatsApp (si téléphone présent)
    const whatsappUrl = phone ? `https://wa.me/${phone.startsWith('+') || phone.startsWith('225') ? phone : '225' + phone}?text=${encodeURIComponent(message)}` : null

    // Construction du lien Gmail (optionnel selon user)
    const gmailUrl = client.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}&su=${encodeURIComponent('Relance Paiement - GestiCom Pro')}&body=${encodeURIComponent(message.replace(/\*/g, ''))}` : null

    return NextResponse.json({
      clientId,
      nom: client.nom,
      email: client.email,
      phone,
      solde: soldeFinal,
      factures: facturesImpayees.map(f => ({
        ...f,
        resteAPayer: f.montantTotal - (f.montantPaye || 0)
      })),
      message,
      whatsappUrl,
      gmailUrl,
      canRelance: true
    })

  } catch (error) {
    console.error('Erreur Relance Client:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const clientId = Number(id)

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    const enterprise = await prisma.parametre.findFirst()
    
    if (!client || !client.email) {
      return NextResponse.json({ error: 'Client introuvable ou email manquant' }, { status: 400 })
    }

    // 1. Récupérer les données pour le PDF
    const facturesImpayees = await prisma.vente.findMany({
      where: { 
        clientId, 
        statut: 'VALIDEE',
        statutPaiement: { in: ['PARTIEL', 'CREDIT'] }
      },
      select: { numero: true, date: true, montantTotal: true, montantPaye: true },
      orderBy: { date: 'asc' }
    })

    const facturesDetail = facturesImpayees.map(f => ({
      ...f,
      resteAPayer: f.montantTotal - (f.montantPaye || 0)
    }))

    const solde = facturesDetail.reduce((acc, f) => acc + f.resteAPayer, 0) + (client.soldeInitial || 0) - (client.avoirInitial || 0)

    // 2. Générer le PDF
    const { generateRelancePDF } = await import('@/lib/pdf-gen')
    const doc = generateRelancePDF({ client, factures: facturesDetail, solde, enterprise })
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // 3. Envoyer l'email
    const { sendRelanceEmail } = await import('@/lib/mail')
    const message = `Bonjour ${client.nom},\n\nVeuillez trouver ci-joint votre relevé de situation concernant vos factures impayées chez ${enterprise?.nomEntreprise || 'notre établissement'}.\nLe solde total dû à ce jour est de ${solde.toLocaleString()} FCFA.\n\nNous comptons sur votre diligence pour la régularisation.\n\nCordialement,\n\nL'équipe de gestion GestiCom Pro.`
    
    await sendRelanceEmail({
      to: client.email,
      subject: `Relance Paiement - ${enterprise?.nomEntreprise || 'GestiCom Pro'}`,
      text: message,
      buffer: pdfBuffer,
      filename: `Relance_${client.nom.replace(/\s+/g, '_')}.pdf`
    })

    return NextResponse.json({ success: true, message: 'Email envoyé avec succès' })

  } catch (error: any) {
    console.error('POST Relance SMTP Error:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
  }
}
