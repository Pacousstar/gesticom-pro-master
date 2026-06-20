import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'

const { jsPDF } = require('jspdf')

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

    const achat = await prisma.achat.findUnique({
      where,
      include: {
        magasin: { select: { code: true, nom: true } },
        fournisseur: { select: { nom: true, telephone: true } },
        lignes: { include: { produit: { select: { designation: true } } } },
        utilisateur: { select: { nom: true } },
      },
    })

    if (!achat) {
      return NextResponse.json({ error: 'Achat introuvable.' }, { status: 404 })
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
    doc.setFont(undefined, 'bold')
    doc.text(nomEntreprise, pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
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
    doc.setFont(undefined, 'bold')
    doc.text('BON D\'ACHAT', pageWidth / 2, y, { align: 'center' })
    y += 10

    // Informations document
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text(`N° ${achat.numero}`, margin, y)
    doc.setFont(undefined, 'normal')
    const dateStr = new Date(achat.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' })
    y += 7
    doc.setFont(undefined, 'normal')
    doc.text(`Magasin: ${achat.magasin.nom} (${achat.magasin.code})`, margin, y)
    y += 7

    // Fournisseur
    y += 3
    doc.setFont(undefined, 'bold')
    doc.text('Fournisseur:', margin, y)
    y += 6
    doc.setFont(undefined, 'normal')
    const fournisseurNom = achat.fournisseur?.nom || achat.fournisseurLibre || 'Fournisseur occasionnel'
    doc.text(fournisseurNom, margin, y)
    y += 5
    if (achat.fournisseur?.telephone) {
      doc.text(`Tél: ${achat.fournisseur.telephone}`, margin, y)
      y += 5
    }
    if (achat.numeroCamion) {
      doc.text(`N° Camion: ${achat.numeroCamion}`, margin, y)
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
    doc.setFont(undefined, 'bold')
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

    doc.setFont(undefined, 'normal')
    let totalTTC = 0

    for (const l of achat.lignes) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = margin + 10
      }

      const pu = l.prixUnitaire || 0
      const qte = l.quantite || 0
      const rem = l.remise || 0
      const mnt = l.montant || 0

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
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('TOTAL TTC:', pageWidth - margin - 60, y)
    doc.text(`${achat.montantTotal.toLocaleString('fr-FR')} F`, pageWidth - margin, y, { align: 'right' })
    y += 8

    if (achat.fraisApproche && achat.fraisApproche > 0) {
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      doc.text(`Frais d'approche: ${achat.fraisApproche.toLocaleString('fr-FR')} F`, margin, y)
      y += 6
    }

    // Paiement
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(`Mode de paiement: ${achat.modePaiement}`, margin, y)
    y += 6
    doc.text(`Montant payé: ${(achat.montantPaye || 0).toLocaleString('fr-FR')} F`, margin, y)
    y += 6
    const reste = Math.max(0, achat.montantTotal - (achat.montantPaye || 0))
    doc.text(`Reste à payer: ${reste.toLocaleString('fr-FR')} F`, margin, y)
    y += 10

    if (achat.observation) {
      doc.setFontSize(8)
      doc.text(`Observation: ${achat.observation}`, margin, y)
      y += 6
    }

    // Pied de page
    doc.setFontSize(7)
    if (achat.utilisateur) {
      doc.text(`Éditée par: ${achat.utilisateur.nom}`, margin, pageHeight - 10)
    }
    doc.text(`Page 1 / 1`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    doc.text(`Document généré par GestiCom Pro le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 5)

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bon-achat-${achat.numero}.pdf"`,
      },
    })
  } catch (error) {
    await apiCatch(error, 'api/achats/[id]/export-pdf')
    return NextResponse.json({ error: "Erreur lors de l'export PDF" }, { status: 500 })
  }
}
