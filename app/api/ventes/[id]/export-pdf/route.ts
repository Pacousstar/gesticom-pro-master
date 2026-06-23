import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'

import jsPDF from 'jspdf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const where: { id: number; entiteId?: number } = { id }
    if (session.role !== 'SUPER_ADMIN') {
      where.entiteId = await getEntiteId(session)
    }

    const vente = await prisma.vente.findUnique({
      where,
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { code: true, nom: true, telephone: true, localisation: true } },
        lignes: { include: { produit: { select: { designation: true } } } },
        utilisateur: { select: { nom: true } },
      },
    })

    if (!vente) {
      return NextResponse.json({ error: 'Vente introuvable.' }, { status: 404 })
    }

    const parametres = await prisma.parametre.findFirst()
    const nomEntreprise = parametres?.nomEntreprise || 'GESTICOM PRO'
    const contactEntreprise = parametres?.contact || ''
    const localisationEntreprise = parametres?.localisation || ''

    const doc = new jsPDF({ orientation: 'portrait' })
    const pageHeight = doc.internal.pageSize.height
    const pageWidth = doc.internal.pageSize.width
    const margin = 15
    const lineHeight = 7

    let y = margin

    // En-tête entreprise
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(nomEntreprise, pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (localisationEntreprise) {
      doc.text(localisationEntreprise, pageWidth / 2, y, { align: 'center' })
      y += 5
    }
    if (contactEntreprise) {
      doc.text(contactEntreprise, pageWidth / 2, y, { align: 'center' })
      y += 5
    }
    y += 5

    // Titre
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('FACTURE', pageWidth / 2, y, { align: 'center' })
    y += 10

    // Informations document
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`N° ${vente.numero}`, margin, y)
    doc.setFont('helvetica', 'normal')
    const dateStr = new Date(vente.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.text(`Magasin: ${vente.magasin.nom} (${vente.magasin.code})`, margin, y)
    y += 7

    // Client
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.text('Client:', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const clientNom = vente.client?.nom || vente.clientLibre || 'Client occasionnel'
    doc.text(clientNom, margin, y)
    y += 5
    if (vente.client?.telephone) {
      doc.text(`Tél: ${vente.client.telephone}`, margin, y)
      y += 5
    }
    if (vente.client?.localisation) {
      doc.text(vente.client.localisation, margin, y)
      y += 5
    }
    y += 5

    // Ligne de séparation
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Entêtes du tableau des lignes
    const colWidths = { designation: 80, quantite: 20, pu: 35, remise: 30, total: 35 }
    const startX = margin
    let xPos = startX

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(240, 240, 240)
    doc.rect(startX, y - 4, colWidths.designation, lineHeight, 'F')
    doc.text('DESIGNATION', startX + 2, y)
    xPos += colWidths.designation
    doc.rect(xPos, y - 4, colWidths.quantite, lineHeight, 'F')
    doc.text('QTÉ', xPos + 2, y)
    xPos += colWidths.quantite
    doc.rect(xPos, y - 4, colWidths.pu, lineHeight, 'F')
    doc.text('P.U', xPos + 2, y)
    xPos += colWidths.pu
    doc.rect(xPos, y - 4, colWidths.remise, lineHeight, 'F')
    doc.text('REMISE', xPos + 2, y)
    xPos += colWidths.remise
    doc.rect(xPos, y - 4, colWidths.total, lineHeight, 'F')
    doc.text('TOTAL', xPos + 2, y)
    y += lineHeight + 1

    doc.setFont('helvetica', 'normal')
    let totalHT = 0
    let totalTVA = 0
    let totalRemise = 0
    let totalTTC = 0

    for (const l of vente.lignes) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = margin + 10
      }

      const pu = l.prixUnitaire || 0
      const qte = l.quantite || 0
      const rem = l.remise || 0
      const tva = l.tva || 0
      const mnt = l.montant || 0
      const ht = qte * pu - rem

      totalHT += ht
      totalTVA += ht * tva / 100
      totalRemise += rem
      totalTTC += mnt

      xPos = startX
      const des = l.designation || l.produit?.designation || ''
      doc.text(des.length > 30 ? des.substring(0, 30) + '...' : des, xPos + 2, y)
      xPos += colWidths.designation
      doc.text(String(qte), xPos + 2, y)
      xPos += colWidths.quantite
      doc.text(pu.toLocaleString('fr-FR'), xPos + 2, y)
      xPos += colWidths.pu
      doc.text(rem > 0 ? `-${rem.toLocaleString('fr-FR')}` : '-', xPos + 2, y)
      xPos += colWidths.remise
      doc.text(`${mnt.toLocaleString('fr-FR')} F`, xPos + 2, y)

      y += lineHeight
    }

    // Séparation
    y += 3
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    // Totaux
    const totX = pageWidth - margin - 60
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    if (vente.remiseGlobale) {
      doc.text('Remise globale:', totX, y)
      doc.text(`-${vente.remiseGlobale.toLocaleString('fr-FR')} F`, pageWidth - margin, y, { align: 'right' })
      y += 7
    }

    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL TTC:', totX, y)
    doc.text(`${vente.montantTotal.toLocaleString('fr-FR')} F`, pageWidth - margin, y, { align: 'right' })
    y += 8

    // Paiement
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Mode de paiement: ${vente.modePaiement}`, margin, y)
    y += 6
    doc.text(`Montant payé: ${(vente.montantPaye || 0).toLocaleString('fr-FR')} F`, margin, y)
    y += 6
    const reste = Math.max(0, vente.montantTotal - (vente.montantPaye || 0))
    doc.text(`Reste à payer: ${reste.toLocaleString('fr-FR')} F`, margin, y)
    y += 10

    if (vente.observation) {
      doc.setFontSize(8)
      doc.text(`Observation: ${vente.observation}`, margin, y)
      y += 6
    }

    // Pied de page
    if (vente.utilisateur) {
      doc.setFontSize(7)
      doc.text(`Éditée par: ${vente.utilisateur.nom}`, margin, pageHeight - 10)
    }
    doc.setFontSize(7)
    doc.text(`Page 1 / 1`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    doc.text(`Document généré par GestiCom Pro le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 5)

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${vente.numero}.pdf"`,
      },
    })
  } catch (error) {
    await apiCatch(error, 'api/ventes/[id]/export-pdf')
    return NextResponse.json({ error: "Erreur lors de l'export PDF" }, { status: 500 })
  }
}
