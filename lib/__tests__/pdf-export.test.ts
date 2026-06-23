import { describe, it, expect } from 'vitest'
import { createDoc, createPdfResponse, addHeader, addCell, addTableHeader, addTableRow } from '@/lib/pdf-export'

describe('createDoc', () => {
  it('crée un document portrait par défaut', () => {
    const doc = createDoc()
    expect(doc).toBeDefined()
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210)
  })

  it('crée un document landscape', () => {
    const doc = createDoc('landscape')
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297)
  })
})

describe('createPdfResponse', () => {
  it('retourne une Response PDF', () => {
    const doc = createDoc()
    const res = createPdfResponse(doc, 'doc.pdf')

    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="doc.pdf"')
    expect(res.status).toBe(200)
  })
})

describe('addHeader', () => {
  it('ajoute un titre et retourne la nouvelle position Y', () => {
    const doc = createDoc()
    const y = addHeader(doc, 'Titre', 'Sous-titre', 15)
    expect(y).toBe(27)
  })
})

describe('addCell', () => {
  it('ne lance pas d\'exception', () => {
    const doc = createDoc()
    expect(() => addCell(doc, 'Texte', 10, 20, 30)).not.toThrow()
  })

  it('accepte les options', () => {
    const doc = createDoc()
    expect(() => addCell(doc, 'Texte', 10, 20, 30, { align: 'right', bold: true, size: 12 })).not.toThrow()
  })
})

describe('addTableHeader', () => {
  it('retourne la nouvelle position Y', () => {
    const doc = createDoc()
    const y = addTableHeader(doc, ['Col1', 'Col2'], [50, 50], 20)
    expect(y).toBe(27)
  })
})

describe('addTableRow', () => {
  it('retourne la nouvelle position Y', () => {
    const doc = createDoc()
    const y = addTableRow(doc, ['Cell1', 'Cell2'], [50, 50], 20)
    expect(y).toBe(26)
  })
})
