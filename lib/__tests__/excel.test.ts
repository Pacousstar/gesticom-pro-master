import { describe, it, expect } from 'vitest'
import { makeResponse, rowsToBuffer } from '@/lib/excel'

describe('makeResponse', () => {
  it('retourne une Response avec les bons headers', () => {
    const buf = Buffer.from('test')
    const res = makeResponse(buf, 'export.xlsx')

    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="export.xlsx"')
    expect(res.status).toBe(200)
  })
})

describe('rowsToBuffer', () => {
  it('produit un Buffer pour des données valides', async () => {
    const buf = await rowsToBuffer([{ nom: 'Test', valeur: 100 }])
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('produit un Buffer vide pour un tableau vide', async () => {
    const buf = await rowsToBuffer([])
    expect(buf).toBeInstanceOf(Buffer)
  })
})
