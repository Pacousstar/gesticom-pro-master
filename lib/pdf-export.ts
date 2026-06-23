import jsPDF from 'jspdf'

export function createPdfResponse(doc: jsPDF, filename: string): Response {
  const buffer = Buffer.from(doc.output('arraybuffer'))
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export function createDoc(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  return new jsPDF(orientation === 'landscape' ? { orientation: 'l', unit: 'mm', format: 'a4' } : undefined)
}

export function addCell(doc: jsPDF, text: string, x: number, y: number, w: number, opts?: { align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number }) {
  doc.setFontSize(opts?.size || 10)
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.text(text, x, y, { align: opts?.align || 'left', maxWidth: w })
}

export function addHeader(doc: jsPDF, title: string, subtitle: string, y: number = 15): number {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 14, y + 6)
  return y + 12
}

export function addTableHeader(doc: jsPDF, columns: string[], widths: number[], y: number, startX: number = 14): number {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(60, 60, 60)
  doc.setTextColor(255, 255, 255)
  let x = startX
  columns.forEach((col, i) => {
    doc.rect(x, y, widths[i], 7, 'F')
    doc.text(col, x + 1, y + 5)
    x += widths[i]
  })
  doc.setTextColor(0, 0, 0)
  return y + 7
}

export function addTableRow(doc: jsPDF, cells: string[], widths: number[], y: number, startX: number = 14): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  let x = startX
  cells.forEach((cell, i) => {
    doc.text(cell, x + 1, y + 4, { maxWidth: widths[i] - 2 })
    x += widths[i]
  })
  return y + 6
}
