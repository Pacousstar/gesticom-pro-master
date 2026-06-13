import ExcelJS from 'exceljs'

export async function rowsToBuffer<T extends Record<string, unknown>>(
  rows: T[],
  sheetName = 'Sheet1',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }))
  if (rows.length > 0) worksheet.addRows(rows)
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED6A30' } }
  headerRow.alignment = { horizontal: 'center' }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

export async function multiSheetToBuffer(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  for (const { name, rows } of sheets) {
    const ws = workbook.addWorksheet(name)
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }))
    if (rows.length > 0) ws.addRows(rows)
    const hr = ws.getRow(1)
    hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED6A30' } }
    hr.alignment = { horizontal: 'center' }
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

export function makeResponse(buffer: Buffer, filename: string): Response {
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function parseExcel<T = Record<string, unknown>>(buffer: Buffer): Promise<{
  rows: T[]
  sheetName: string
}> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as never)
  const worksheet = workbook.worksheets[0]
  const rows: T[] = []
  const headers: string[] = []
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(cell.text?.trim() || '')
      })
    } else {
      const rowData: Record<string, unknown> = {}
      let empty = true
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= headers.length) {
          const val = cell.value
          rowData[headers[colNumber - 1]] = val
          if (val !== null && val !== undefined && val !== '') empty = false
        }
      })
      if (!empty) rows.push(rowData as T)
    }
  })
  return { rows, sheetName: workbook.worksheets[0].name }
}
