import { jsPDF } from 'jspdf'

export function generateRelancePDF({ client, factures, solde, enterprise }: any) {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(22)
  doc.setTextColor(255, 102, 0) // Orange GestiCom
  doc.text(enterprise?.nomEntreprise || 'GestiCom Pro', 10, 20)
  
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(enterprise?.contact || '', 10, 26)
  doc.text(enterprise?.localisation || '', 10, 31)

  // Title
  doc.setFontSize(18)
  doc.setTextColor(0)
  doc.text('RELEVÉ DE DETTE ET RELANCE', 105, 50, { align: 'center' })

  // Client Info
  doc.setFontSize(12)
  doc.text(`DESTINATAIRE :`, 10, 70)
  doc.setFont('helvetica', 'bold')
  doc.text(`${client.nom}`, 10, 76)
  doc.setFont('helvetica', 'normal')
  doc.text(`Tél : ${client.telephone || 'N/A'}`, 10, 82)
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 160, 70)

  // Solde Global
  doc.setFillColor(240, 240, 240)
  doc.rect(10, 95, 190, 15, 'F')
  doc.setFontSize(14)
  doc.text(`SOLDE GLOBAL DU :`, 15, 105)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(200, 0, 0)
  doc.text(`${solde.toLocaleString()} FCFA`, 195, 105, { align: 'right' })

  // Factures Table
  doc.setTextColor(0)
  doc.setFontSize(12)
  doc.text('DÉTAIL DES FACTURES IMPAYÉES', 10, 125)
  
  let y = 135
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('N° Facture', 15, y)
  doc.text('Date', 50, y)
  doc.text('Montant Total', 85, y)
  doc.text('Payé', 130, y)
  doc.text('Reste à Payer', 170, y)
  
  doc.line(10, y + 2, 200, y + 2)
  y += 10
  
  doc.setFont('helvetica', 'normal')
  factures.forEach((f: any) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(f.numero, 15, y)
    doc.text(new Date(f.date).toLocaleDateString('fr-FR'), 50, y)
    doc.text(f.montantTotal.toLocaleString(), 85, y)
    doc.text((f.montantPaye || 0).toLocaleString(), 130, y)
    doc.text(f.resteAPayer.toLocaleString(), 170, y)
    y += 8
  })

  // Footer
  doc.setFontSize(9)
  doc.setTextColor(150)
  doc.text(`Document généré par GestiCom Pro Intelligent. Merci de régulariser votre situation dans les plus brefs délais.`, 105, 285, { align: 'center' })

  return doc
}
